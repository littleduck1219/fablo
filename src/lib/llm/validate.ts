import Anthropic from "@anthropic-ai/sdk";
import { normalizeEndpoint } from "./client";
import { SERVER_CHATGPT_CREDENTIAL } from "./openai-oauth";

export type ValidationResult = {
  ok: boolean;
  /** 프로바이더가 동적 모델 목록을 제공하면 채워진다 (예: Ollama 로컬 모델) */
  models?: string[];
  error?: string;
};

/** 연결 시 자격 증명을 실제로 검증한다 (가벼운 목록 조회). */
/** 키 접두어로 프로바이더 오입력을 미리 잡아준다. */
function keyMismatchHint(providerId: string, credential: string): string | null {
  const key = credential.trim();
  if (providerId === "openai" && key === SERVER_CHATGPT_CREDENTIAL) return null;
  if (providerId !== "openrouter" && key.startsWith("sk-or-")) {
    return "OpenRouter에서 발급한 키(sk-or-…)입니다. 왼쪽 목록에서 OpenRouter를 선택해 연결하세요.";
  }
  if (providerId === "anthropic" && key.startsWith("sk-") && !key.startsWith("sk-ant-")) {
    return "Anthropic 키는 sk-ant- 로 시작합니다. 다른 서비스의 키로 보여요 — 발급처에 맞는 프로바이더를 선택하세요.";
  }
  if (providerId === "openrouter" && !key.startsWith("sk-or-")) {
    return "OpenRouter 키는 sk-or- 로 시작합니다. 키를 다시 확인해 주세요.";
  }
  return null;
}

export async function validateConnection(
  providerId: string,
  credential: string,
): Promise<ValidationResult> {
  const hint = keyMismatchHint(providerId, credential);
  if (hint) return { ok: false, error: hint };

  try {
    switch (providerId) {
      case "anthropic": {
        const client = new Anthropic({ apiKey: credential, dangerouslyAllowBrowser: true });
        await client.models.list();
        return { ok: true };
      }
      case "openrouter": {
        const res = await fetch("https://openrouter.ai/api/v1/key", {
          headers: { authorization: `Bearer ${credential}` },
        });
        if (!res.ok) return authFail(res.status);
        return { ok: true };
      }
      case "openai": {
        if (credential === SERVER_CHATGPT_CREDENTIAL) {
          const res = await fetch("/api/openai/models", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ useServerToken: true }),
          });
          if (!res.ok) {
            return { ok: false, error: "서버 ChatGPT 구독 토큰을 확인하지 못했습니다." };
          }
          const j = await res.json().catch(() => ({}));
          const models = Array.isArray(j?.models)
            ? j.models.map((m: { slug?: string }) => m?.slug).filter(Boolean)
            : [];
          return { ok: true, models };
        }
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { authorization: `Bearer ${credential}` },
        });
        if (!res.ok) return authFail(res.status);
        return { ok: true };
      }
      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(credential)}&pageSize=1`,
        );
        if (!res.ok) return authFail(res.status);
        return { ok: true };
      }
      case "ollama": {
        const res = await fetch(`${normalizeEndpoint(credential)}/api/tags`);
        if (!res.ok) return { ok: false, error: `엔드포인트 응답 오류 (HTTP ${res.status})` };
        const j = await res.json();
        const models = Array.isArray(j?.models)
          ? j.models.map((m: { name?: string }) => m?.name).filter(Boolean)
          : [];
        if (models.length === 0) {
          return { ok: false, error: "실행 중인 모델이 없습니다. `ollama pull <model>` 후 다시 시도하세요." };
        }
        return { ok: true, models };
      }
      default:
        return { ok: false, error: "지원하지 않는 프로바이더입니다." };
    }
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return err.status === 401
        ? { ok: false, error: "API 키가 유효하지 않습니다." }
        : { ok: false, error: err.message };
    }
    return {
      ok: false,
      error:
        providerId === "ollama"
          ? "엔드포인트에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요."
          : "연결에 실패했습니다. 네트워크와 키를 확인해 주세요.",
    };
  }
}

function authFail(status: number): ValidationResult {
  return status === 401 || status === 403
    ? { ok: false, error: "API 키가 유효하지 않습니다." }
    : { ok: false, error: `검증 요청이 실패했습니다 (HTTP ${status}).` };
}
