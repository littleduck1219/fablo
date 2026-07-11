import assert from "node:assert/strict";
import test from "node:test";
import { chooseChatGptModel } from "./openai-oauth.ts";

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
