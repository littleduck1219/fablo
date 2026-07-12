"use client";

/**
 * ChatGPT 구독(Plus/Pro) OAuth 로그인 — OpenAI Codex CLI의 공개 OAuth 클라이언트와
 * 동일한 PKCE 흐름을 사용한다 (opencode 등 외부 에이전트들이 쓰는 방식).
 *
 * 흐름:
 * 1. PKCE 생성 → auth.openai.com 로그인 창 열기
 * 2. 로그인 후 localhost:1455 로 리디렉션 (페이지는 안 열리는 게 정상)
 * 3. 사용자가 주소창의 전체 URL을 복사해 붙여넣기 → code 추출
 * 4. /api/openai/oauth/token 프록시로 토큰 교환 (CORS 회피)
 */

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"; // Codex CLI 공개 클라이언트
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";

/**
 * ChatGPT 구독 모델 폴백 목록 — 실제 목록은 연결 직후 백엔드 카탈로그
 * (fetchChatGptModels)에서 가져와 대체된다. Codex 백엔드는 카탈로그에 있는
 * codex 계열 모델만 허용한다.
 */
export const CHATGPT_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"];

export function chooseChatGptModel(models: string[], current?: string | null): string {
  if (current && models.includes(current)) return current;
  return models[0] ?? CHATGPT_MODELS[0];
}

/** Codex 백엔드에서 이 계정이 사용 가능한 모델 슬러그 목록을 가져온다. */
export async function fetchChatGptModels(cred: ChatGptOAuth): Promise<string[]> {
  const res = await fetch("/api/openai/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: cred.access_token, accountId: cred.account_id }),
  });
  if (!res.ok) return [];
  const j = (await res.json().catch(() => ({}))) as {
    models?: { slug?: string; show_in_picker?: boolean }[];
  };
  if (!Array.isArray(j.models)) return [];
  const slugs = j.models
    .filter((m) => typeof m?.slug === "string" && m.show_in_picker !== false)
    .map((m) => m.slug as string);
  return [...new Set(slugs)].slice(0, 10);
}

export type ChatGptOAuth = {
  kind: "chatgpt-oauth";
  access_token: string;
  refresh_token: string;
  account_id: string;
  email?: string;
  /** epoch ms */
  expires_at: number;
};

export function isOAuthCredential(credential: string): boolean {
  if (!credential.startsWith("{")) return false;
  try {
    return (JSON.parse(credential) as { kind?: string }).kind === "chatgpt-oauth";
  } catch {
    return false;
  }
}

/* ---------- PKCE ---------- */

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type AuthRequest = { url: string; verifier: string; state: string };

/* ---------- 진행 중인 로그인 상태 (탭 간 공유를 위해 localStorage 사용) ---------- */

const PENDING_KEY = "fablo:oauth-pending";

export function savePendingAuth(req: AuthRequest): void {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ verifier: req.verifier, state: req.state, ts: Date.now() }),
    );
  } catch {
    /* 저장 실패 무시 — 붙여넣기 폴백은 다이얼로그 메모리로 동작 */
  }
}

export function loadPendingAuth(): { verifier: string; state: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { verifier?: string; state?: string; ts?: number };
    if (!j.verifier || !j.state) return null;
    // 15분 지난 시도는 무시
    if (j.ts && Date.now() - j.ts > 15 * 60_000) return null;
    return { verifier: j.verifier, state: j.state };
  } catch {
    return null;
  }
}

export function clearPendingAuth(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* noop */
  }
}

async function createBrowserAuthRequest(): Promise<AuthRequest> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = base64url(new Uint8Array(digest));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid profile email offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state,
  });

  return { url: `${AUTHORIZE_URL}?${params.toString()}`, verifier, state };
}

async function createServerAuthRequest(): Promise<AuthRequest> {
  const res = await fetch("/api/openai/oauth/auth-request", { method: "POST" });
  const req = (await res.json().catch(() => null)) as AuthRequest | null;
  if (!res.ok || !req?.url || !req.verifier || !req.state) {
    throw new Error("로그인 URL 생성에 실패했습니다.");
  }
  return req;
}

export async function createAuthRequest(): Promise<AuthRequest> {
  try {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto unavailable");
    return await createBrowserAuthRequest();
  } catch {
    return createServerAuthRequest();
  }
}

/** 붙여넣은 리디렉션 URL(또는 code 값)에서 인가 코드를 추출한다. */
export function parseCallback(input: string, expectedState: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("리디렉션된 URL을 붙여넣어 주세요.");

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error("URL 형식이 올바르지 않습니다.");
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) throw new Error("URL에 인가 코드(code)가 없습니다. 로그인 후의 주소를 복사했는지 확인해 주세요.");
    if (state && state !== expectedState) {
      throw new Error("state 값이 일치하지 않습니다. 로그인을 처음부터 다시 시도해 주세요.");
    }
    return code;
  }
  // 사용자가 code 값만 붙여넣은 경우
  return trimmed;
}

/* ---------- 토큰 교환 / 갱신 (프록시 경유) ---------- */

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string | { message?: string; code?: string | number };
  error_description?: string;
};

async function callTokenProxy(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("/api/openai/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !j.access_token) {
    const detail =
      j.error_description ||
      (typeof j.error === "string" ? j.error : j.error?.message) ||
      `HTTP ${res.status}`;
    throw new Error(`토큰 교환에 실패했습니다: ${detail}`);
  }
  return j;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    const payload = jwt.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export async function exchangeCode(code: string, verifier: string): Promise<ChatGptOAuth> {
  const t = await callTokenProxy({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  const claims = decodeJwtPayload(t.id_token ?? t.access_token);
  const auth = (claims["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
  const accountId =
    (typeof auth.chatgpt_account_id === "string" && auth.chatgpt_account_id) ||
    (typeof claims.sub === "string" && claims.sub) ||
    "";
  if (!accountId) throw new Error("ChatGPT 계정 정보를 확인하지 못했습니다.");

  return {
    kind: "chatgpt-oauth",
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? "",
    account_id: accountId,
    email: typeof claims.email === "string" ? claims.email : undefined,
    expires_at: Date.now() + (t.expires_in ?? 3600) * 1000,
  };
}

/**
 * Codex CLI / VSCode Codex의 `~/.codex/auth.json` 내용에서 토큰을 가져온다.
 * Cloudflare 봇체크 등으로 브라우저 OAuth가 막힐 때의 우회 경로 — 네트워크 없이 파싱만 한다.
 */
export function parseCodexAuthJson(text: string): ChatGptOAuth {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text.trim());
  } catch {
    throw new Error("JSON 형식이 아닙니다. ~/.codex/auth.json 파일 내용 전체를 붙여넣어 주세요.");
  }
  const t = (j.tokens ?? j) as Record<string, unknown>;
  const access = typeof t.access_token === "string" ? t.access_token : "";
  if (!access) {
    throw new Error("access_token을 찾을 수 없습니다. Codex CLI에 로그인된 auth.json이 맞는지 확인해 주세요.");
  }
  const refresh = typeof t.refresh_token === "string" ? t.refresh_token : "";

  const idClaims = decodeJwtPayload(typeof t.id_token === "string" ? t.id_token : access);
  const auth = (idClaims["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
  const accountId =
    (typeof t.account_id === "string" && t.account_id) ||
    (typeof auth.chatgpt_account_id === "string" && auth.chatgpt_account_id) ||
    (typeof idClaims.sub === "string" && idClaims.sub) ||
    "";
  if (!accountId) throw new Error("ChatGPT 계정 ID를 확인하지 못했습니다.");

  const accessClaims = decodeJwtPayload(access);
  const expiresAt =
    typeof accessClaims.exp === "number"
      ? accessClaims.exp * 1000
      : Date.now(); // 만료 시각을 모르면 만료로 취급 → 첫 요청에서 자동 갱신

  return {
    kind: "chatgpt-oauth",
    access_token: access,
    refresh_token: refresh,
    account_id: accountId,
    email: typeof idClaims.email === "string" ? idClaims.email : undefined,
    expires_at: expiresAt,
  };
}

/** 만료 임박 시 refresh_token으로 갱신. 갱신되면 새 자격 증명을 반환, 아니면 원본 반환. */
export async function refreshIfNeeded(cred: ChatGptOAuth): Promise<ChatGptOAuth> {
  if (cred.expires_at - Date.now() > 60_000) return cred;
  if (!cred.refresh_token) {
    throw new Error("세션이 만료되었습니다. ChatGPT로 다시 로그인해 주세요.");
  }
  const t = await callTokenProxy({
    grant_type: "refresh_token",
    refresh_token: cred.refresh_token,
    client_id: CLIENT_ID,
    scope: "openid profile email",
  });
  return {
    ...cred,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? cred.refresh_token,
    expires_at: Date.now() + (t.expires_in ?? 3600) * 1000,
  };
}
