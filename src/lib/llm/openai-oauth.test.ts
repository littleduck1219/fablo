import assert from "node:assert/strict";
import test from "node:test";
import { POST as createAuthRequest } from "../../app/api/openai/oauth/auth-request/route.ts";
import { POST as listModels } from "../../app/api/openai/models/route.ts";
import { chooseChatGptModel, parseChatGptModelCatalog } from "./openai-oauth.ts";

test("chooseChatGptModel replaces unsupported saved models with the first available model", () => {
  assert.equal(
    chooseChatGptModel(["gpt-5.5", "gpt-5.4"], "gpt-5.2-codex"),
    "gpt-5.5",
  );
});

test("chooseChatGptModel keeps a saved model when it is still available", () => {
  assert.equal(
    chooseChatGptModel(["gpt-5.5", "gpt-5.4"], "gpt-5.4"),
    "gpt-5.4",
  );
});

test("model catalog keeps current user models and drops retired or internal entries", () => {
  assert.deepEqual(
    parseChatGptModelCatalog({
      models: [
        { slug: "gpt-5.6-sol" },
        { slug: "gpt-5.1-codex-max" },
        { slug: "codex-auto-review" },
        { slug: "gpt-5.6-sol" },
      ],
    }),
    ["gpt-5.6-sol"],
  );
});

test("server auth request creates a PKCE login URL", async () => {
  const res = await createAuthRequest();
  assert.equal(res.ok, true);
  const j = (await res.json()) as { url: string; verifier: string; state: string };
  const url = new URL(j.url);
  assert.equal(url.origin, "https://auth.openai.com");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(j.verifier.length > 40);
  assert.ok(j.state.length > 10);
});

test("server ChatGPT mode reports missing server token config", async () => {
  const res = await listModels(
    new Request("http://localhost/api/openai/models", {
      method: "POST",
      body: JSON.stringify({ useServerToken: true }),
    }),
  );
  assert.equal(res.status, 503);
});
