import { createHash, randomBytes } from "node:crypto";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export async function POST(): Promise<Response> {
  const verifier = base64url(randomBytes(48));
  const state = base64url(randomBytes(16));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

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

  return Response.json({ url: `${AUTHORIZE_URL}?${params.toString()}`, verifier, state });
}
