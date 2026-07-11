import type { Provider } from "./types";

/**
 * 프로바이더 카탈로그. 연결 전 초기 상태 — 자격 증명은 사용자가 입력한다.
 * Ollama는 연결 시 /api/tags에서 실제 로컬 모델 목록으로 대체된다.
 */
export const INITIAL_PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["claude-opus-4-8", "claude-fable-5", "claude-sonnet-5", "claude-haiku-4-5"],
    status: "disconnected",
  },
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-5.1", "gpt-5.1-mini", "gpt-4.1"],
    status: "disconnected",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: [
      "anthropic/claude-opus-4.8",
      "anthropic/claude-sonnet-5",
      "anthropic/claude-fable-5",
      "anthropic/claude-haiku-4.5",
      "openai/gpt-5.5",
      "google/gemini-3.5-flash",
      "deepseek/deepseek-v4-pro",
    ],
    status: "disconnected",
  },
  {
    id: "google",
    name: "Google",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
    status: "disconnected",
  },
  {
    id: "ollama",
    name: "Ollama (로컬)",
    models: [],
    status: "disconnected",
    local: true,
  },
];

export const SUGGESTIONS = [
  {
    title: "습관 트래커 앱",
    prompt:
      "습관 트래커 앱을 만들고 싶어. 매일 루틴을 체크하고 연속 달성 스트릭을 보여주는 게 핵심이야.",
  },
  {
    title: "팀 위키 + AI 검색",
    prompt: "사내 문서를 모아 AI로 검색·요약해 주는 팀 위키 SaaS의 PRD를 만들어줘.",
  },
  {
    title: "중고거래 에스크로",
    prompt: "중고거래에 안전결제(에스크로)를 붙인 C2C 마켓 앱의 PRD 초안을 잡아줘.",
  },
];
