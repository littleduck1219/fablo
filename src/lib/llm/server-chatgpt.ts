import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

export type ServerChatGptToken = {
  access_token: string;
  refresh_token: string;
  account_id: string;
  expires_at: number;
};

let cached: ServerChatGptToken | null = null;

export function getFabloCodexHome(): string {
  return process.env.FABLO_CODEX_HOME ?? join(homedir(), ".fablo", "codex");
}

export function resetServerChatGptTokenCache(): void {
  cached = null;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function parseServerToken(): ServerChatGptToken {
  const raw =
    process.env.FABLO_CHATGPT_AUTH_JSON ??
    readFileSync(
      process.env.FABLO_CHATGPT_AUTH_FILE ?? join(getFabloCodexHome(), "auth.json"),
      "utf8",
    );

  const j = JSON.parse(raw) as Record<string, unknown>;
  const t = (j.tokens ?? j) as Record<string, unknown>;
  const access = typeof t.access_token === "string" ? t.access_token : "";
  const refresh = typeof t.refresh_token === "string" ? t.refresh_token : "";
  if (!access || !refresh) {
    throw new Error("FABLO_CHATGPT_AUTH_JSON needs access_token and refresh_token");
  }

  const idClaims = decodeJwtPayload(typeof t.id_token === "string" ? t.id_token : access);
  const auth = (idClaims["https://api.openai.com/auth"] ?? {}) as Record<string, unknown>;
  const accountId =
    (typeof t.account_id === "string" && t.account_id) ||
    (typeof auth.chatgpt_account_id === "string" && auth.chatgpt_account_id) ||
    (typeof idClaims.sub === "string" && idClaims.sub) ||
    "";
  if (!accountId) throw new Error("Cannot resolve ChatGPT account id");

  const accessClaims = decodeJwtPayload(access);
  return {
    access_token: access,
    refresh_token: refresh,
    account_id: accountId,
    expires_at: typeof accessClaims.exp === "number" ? accessClaims.exp * 1000 : Date.now(),
  };
}

export async function getServerChatGptToken(): Promise<ServerChatGptToken> {
  cached ??= parseServerToken();
  if (cached.expires_at - Date.now() > 60_000) return cached;

  const upstream = await fetch("https://auth.openai.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cached.refresh_token,
      client_id: CLIENT_ID,
      scope: "openid profile email",
    }).toString(),
  });

  const j = (await upstream.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: unknown;
  };
  if (!upstream.ok || !j.access_token) {
    throw new Error(`Cannot refresh server ChatGPT token: ${JSON.stringify(j.error ?? j)}`);
  }

  cached = {
    ...cached,
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? cached.refresh_token,
    expires_at: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
  return cached;
}
