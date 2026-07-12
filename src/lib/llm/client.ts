import Anthropic from "@anthropic-ai/sdk";
import { CODEX_BASE_INSTRUCTIONS } from "./codex-instructions";
import {
  isOAuthCredential,
  isServerChatGptCredential,
  refreshIfNeeded,
  type ChatGptOAuth,
} from "./openai-oauth";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type StreamParams = {
  providerId: string;
  model: string;
  credential: string;
  system: string;
  messages: ChatTurn[];
  signal: AbortSignal;
  onText: (delta: string) => void;
  /** OAuth 토큰이 갱신되면 저장소에 반영하기 위한 콜백 */
  onCredentialRefresh?: (credential: string) => void;
};

/** 프로바이더별 스트리밍 채팅. 완료 시 resolve, 실패 시 사용자에게 보여줄 메시지로 throw. */
export async function streamChat(params: StreamParams): Promise<void> {
  switch (params.providerId) {
    case "anthropic":
      return streamAnthropic(params);
    case "openai":
      return isOAuthCredential(params.credential) || isServerChatGptCredential(params.credential)
        ? streamChatGptSubscription(params)
        : streamOpenAICompat(params, "https://api.openai.com/v1");
    case "openrouter":
      return streamOpenAICompat(params, "https://openrouter.ai/api/v1");
    case "ollama":
      return streamOpenAICompat(params, `${normalizeEndpoint(params.credential)}/v1`, false);
    case "google":
      return streamGoogle(params);
    default:
      throw new Error(`지원하지 않는 프로바이더입니다: ${params.providerId}`);
  }
}

/* ---------- ChatGPT 구독 (OAuth → Codex Responses API, 프록시 경유) ---------- */

async function streamChatGptSubscription({
  model, credential, system, messages, signal, onText, onCredentialRefresh,
}: StreamParams): Promise<void> {
  let cred: ChatGptOAuth | null = null;
  if (!isServerChatGptCredential(credential)) {
    cred = JSON.parse(credential) as ChatGptOAuth;
    const refreshed = await refreshIfNeeded(cred);
    if (refreshed !== cred) {
      cred = refreshed;
      onCredentialRefresh?.(JSON.stringify(cred));
    }
  }

  // Codex 백엔드는 instructions가 공식 Codex 프롬프트가 아니면 400으로 거부한다.
  // 따라서 instructions에는 원문을 넣고, Fablo 시스템 프롬프트는 developer 메시지로 주입한다.
  const payload = {
    model,
    instructions: CODEX_BASE_INSTRUCTIONS,
    input: [
      {
        type: "message",
        role: "developer",
        content: [{ type: "input_text", text: system }],
      },
      ...messages.map((m) => ({
        type: "message",
        role: m.role,
        content: [
          m.role === "assistant"
            ? { type: "output_text", text: m.content }
            : { type: "input_text", text: m.content },
        ],
      })),
    ],
    tools: [],
    tool_choice: "auto",
    parallel_tool_calls: false,
    stream: true,
    store: false,
    include: [],
  };

  const res = await fetch("/api/openai/responses", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(cred
        ? { accessToken: cred.access_token, accountId: cred.account_id }
        : { useServerToken: true }),
      payload,
    }),
  }).catch((err) => {
    throw toFriendlyError(err, "요청");
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("ChatGPT 세션이 만료되었습니다. 모델 연결에서 다시 로그인해 주세요.");
    }
    throw await httpError(res);
  }

  await readSSE(res, (data) => {
    if (data === "[DONE]") return;
    try {
      const j = JSON.parse(data);
      if (j.type === "response.output_text.delta" && typeof j.delta === "string") {
        onText(j.delta);
      } else if (j.type === "response.failed" || j.type === "error") {
        const msg = j?.response?.error?.message ?? j?.message;
        if (typeof msg === "string" && msg) throw new Error(msg);
      }
    } catch (err) {
      if (err instanceof Error && err.message && !(err instanceof SyntaxError)) throw err;
      /* 불완전 청크 무시 */
    }
  });
}

/* ---------- Anthropic (공식 SDK) ---------- */

/** adaptive thinking을 지원하는 모델 (Fable 5는 항상 켜져 있어 파라미터를 생략) */
const ADAPTIVE_THINKING = /opus-4-[678]|sonnet-5|sonnet-4-6/;

async function streamAnthropic({
  model, credential, system, messages, signal, onText,
}: StreamParams): Promise<void> {
  const client = new Anthropic({
    apiKey: credential,
    dangerouslyAllowBrowser: true, // 키는 사용자 브라우저에만 존재
  });

  try {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 64000,
        system,
        ...(ADAPTIVE_THINKING.test(model) ? { thinking: { type: "adaptive" as const } } : {}),
        messages,
      },
      { signal },
    );
    stream.on("text", onText);
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new Error("모델이 이 요청을 거부했습니다. 요청을 바꿔 다시 시도해 주세요.");
    }
  } catch (err) {
    throw toFriendlyError(err, "Anthropic");
  }
}

/* ---------- OpenAI 호환 (OpenAI, Ollama) ---------- */

async function streamOpenAICompat(
  { model, credential, system, messages, signal, onText }: StreamParams,
  baseUrl: string,
  useAuth = true,
): Promise<void> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      ...(useAuth ? { authorization: `Bearer ${credential}` } : {}),
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  }).catch((err) => {
    throw toFriendlyError(err, "요청");
  });

  if (!res.ok) throw await httpError(res);

  await readSSE(res, (data) => {
    if (data === "[DONE]") return;
    try {
      const j = JSON.parse(data);
      const t = j.choices?.[0]?.delta?.content;
      if (typeof t === "string" && t) onText(t);
    } catch {
      /* 불완전 청크 무시 */
    }
  });
}

/* ---------- Google Gemini ---------- */

async function streamGoogle({
  model, credential, system, messages, signal, onText,
}: StreamParams): Promise<void> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(credential)}`;

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  }).catch((err) => {
    throw toFriendlyError(err, "요청");
  });

  if (!res.ok) throw await httpError(res);

  await readSSE(res, (data) => {
    try {
      const j = JSON.parse(data);
      const parts = j.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) if (typeof p?.text === "string") onText(p.text);
      }
    } catch {
      /* 불완전 청크 무시 */
    }
  });
}

/* ---------- 공용 헬퍼 ---------- */

export function normalizeEndpoint(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function readSSE(res: Response, onData: (data: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("스트림 응답을 읽을 수 없습니다.");
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) onData(trimmed.slice(5).trim());
    }
  }
}

async function httpError(res: Response): Promise<Error> {
  let detail = "";
  try {
    const j = await res.json();
    detail =
      j?.error?.message ??
      (typeof j?.detail === "string" ? j.detail : undefined) ??
      j?.message ??
      "";
  } catch {
    /* body 없음 */
  }
  if (res.status === 401 || res.status === 403) {
    return new Error("인증에 실패했습니다. API 키를 확인해 주세요.");
  }
  if (res.status === 429) {
    return new Error("요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return new Error(detail || `요청이 실패했습니다 (HTTP ${res.status}).`);
}

function toFriendlyError(err: unknown, label: string): Error {
  if (err instanceof DOMException && err.name === "AbortError") return err as unknown as Error;
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401) return new Error("인증에 실패했습니다. API 키를 확인해 주세요.");
    if (err.status === 429) return new Error("요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    return new Error(err.message || `${label} 요청이 실패했습니다.`);
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") return err;
    if (/fetch|network/i.test(err.message)) {
      return new Error("네트워크 오류가 발생했습니다. 연결 상태를 확인해 주세요.");
    }
    return err;
  }
  return new Error(`${label} 요청 중 알 수 없는 오류가 발생했습니다.`);
}
