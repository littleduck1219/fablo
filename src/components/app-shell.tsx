"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArchivePanel, sessionTitle } from "@/components/archive-panel";
import { ChatPanel } from "@/components/chat-panel";
import { HistoryPanel } from "@/components/history-panel";
import { ModelDialog } from "@/components/model-dialog";
import { NavRail, type SidePanel } from "@/components/nav-rail";
import { SettingsDialog } from "@/components/settings-dialog";
import { TemplatePanel } from "@/components/template-panel";
import { Workspace, type WorkspaceTab } from "@/components/workspace";
import { streamChat, type ChatTurn } from "@/lib/llm/client";
import {
  clearPendingAuth,
  chooseChatGptModel,
  exchangeCode,
  fetchChatGptModels,
  isOAuthCredential,
  loadPendingAuth,
  refreshIfNeeded,
  CHATGPT_MODELS,
  type ChatGptOAuth,
} from "@/lib/llm/openai-oauth";
import { extractPayload, extractQuestions, generationProgress, visibleText } from "@/lib/llm/parse";
import { buildSystemPrompt } from "@/lib/llm/prompt";
import { validateConnection } from "@/lib/llm/validate";
import { INITIAL_PROVIDERS } from "@/lib/mock";
import type { PrdTemplate } from "@/lib/templates";
import { samePrdContent } from "@/lib/prd";
import type { ActiveModel, DocSnapshot, GraphSpec, Message, PrdDoc, Provider, Session, SpecDoc } from "@/lib/types";

const STORAGE_KEY = "fablo:v1";

let idSeq = 1;
const nextId = () => `m${Date.now()}-${idSeq++}`;

function newSession(): Session {
  const now = Date.now();
  return { id: nextId(), createdAt: now, updatedAt: now, messages: [], doc: null, graph: null, spec: null };
}

/** pending 메시지(스트리밍 중 끊긴 말풍선)를 걷어내되, 없으면 참조를 유지한다 */
const cleanMessages = (ms: Message[]) =>
  ms.some((m) => m.pending) ? ms.filter((m) => !m.pending) : ms;

/** 히스토리 없는 세션의 공용 빈 배열 — 참조 비교로 updatedAt 오염을 막는다 */
const EMPTY_HISTORY: DocSnapshot[] = [];

// ponytail: 스냅샷 최근 20개 상한 — localStorage 용량 보호, 부족해지면 IndexedDB로
const HISTORY_MAX = 20;
const pushSnapshot = (
  h: DocSnapshot[],
  doc: PrdDoc,
  graph: GraphSpec | null,
  spec: SpecDoc | null,
): DocSnapshot[] =>
  [...h, { version: doc.version, savedAt: Date.now(), doc, graph, spec }].slice(-HISTORY_MAX);

type PersistedState = {
  providers: Provider[];
  activeModel: ActiveModel;
  sessions: Session[];
  activeSessionId: string;
  /** v1 호환 — 세션 도입 전 단일 대화 저장분 (마이그레이션용) */
  messages?: Message[];
  doc?: PrdDoc | null;
  graph?: GraphSpec | null;
};

export function AppShell() {
  // 모델 연결
  const [providers, setProviders] = useState<Provider[]>(INITIAL_PROVIDERS);
  const [activeModel, setActiveModel] = useState<ActiveModel>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connectError, setConnectError] = useState<{ providerId: string; message: string } | null>(null);

  // 대화 / 문서 (활성 세션의 라이브 상태)
  const [messages, setMessages] = useState<Message[]>([]);
  const [doc, setDoc] = useState<PrdDoc | null>(null);
  const [graph, setGraph] = useState<GraphSpec | null>(null);
  const [spec, setSpec] = useState<SpecDoc | null>(null);
  const [history, setHistory] = useState<DocSnapshot[]>(EMPTY_HISTORY);
  const [streaming, setStreaming] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("prd");
  const [docPulse, setDocPulse] = useState(false);

  // 문서 보관함 (다중 세션) / 사이드 패널 / 설정
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [panel, setPanel] = useState<SidePanel>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  /** 세션 내용을 라이브 상태로 불러온다 (세션 전환/삭제/하이드레이션 공용) */
  const loadSession = useCallback((s: Session) => {
    setActiveSessionId(s.id);
    setMessages(cleanMessages(s.messages));
    setDoc(s.doc);
    setGraph(s.graph);
    setSpec(s.spec ?? null);
    setHistory(s.history ?? EMPTY_HISTORY);
    setDocPulse(false);
    setTab("prd");
  }, []);

  /** Codex 백엔드 카탈로그에서 이 계정의 실제 모델 목록을 받아와 반영한다. */
  const refreshChatGptModels = useCallback(async (credential: string) => {
    try {
      let cred = JSON.parse(credential) as ChatGptOAuth;
      const fresh = await refreshIfNeeded(cred);
      if (fresh !== cred) {
        cred = fresh;
        const json = JSON.stringify(fresh);
        setProviders((ps) => ps.map((p) => (p.id === "openai" ? { ...p, credential: json } : p)));
      }
      const models = await fetchChatGptModels(cred);
      if (models.length === 0) return; // 실패 시 폴백 목록 유지
      setProviders((ps) => ps.map((p) => (p.id === "openai" ? { ...p, models } : p)));
      setActiveModel((am) =>
        am?.providerId === "openai" && !models.includes(am.model)
          ? { providerId: "openai", model: chooseChatGptModel(models, am.model) }
          : am,
      );
    } catch {
      /* 폴백 목록 유지 */
    }
  }, []);

  /* ---------- 로컬 영속화 (키 포함 — 브라우저에만 저장) ---------- */

  useEffect(() => {
    let loaded: Session[] | null = null;
    let loadedActive: Session | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<PersistedState>;
        const savedOpenai = s.providers?.find((p) => p.id === "openai");
        const openaiIsOAuth = !!savedOpenai?.credential && isOAuthCredential(savedOpenai.credential);

        if (Array.isArray(s.providers)) {
          // 카탈로그(모델 목록 등)는 최신 코드 기준, 연결 상태·키는 저장분 복원
          setProviders(
            INITIAL_PROVIDERS.map((base) => {
              const saved = s.providers?.find((p) => p.id === base.id);
              if (!saved) return base;
              return {
                ...base,
                status: saved.status === "connected" ? "connected" : "disconnected",
                credential: saved.credential,
                keyMask: saved.keyMask,
                models:
                  // ChatGPT 구독은 항상 최신 Codex 모델 카탈로그로 교정 (과거 잘못된 목록 마이그레이션)
                  base.id === "openai" && openaiIsOAuth
                    ? CHATGPT_MODELS
                    : // 연결 상태에서 동적으로 받아온 목록(Ollama)은 유지
                      saved.status === "connected" && saved.models?.length
                      ? saved.models
                      : base.models,
              };
            }),
          );
        }
        if (s.activeModel !== undefined) {
          let am = s.activeModel ?? null;
          // 저장된 활성 모델이 구독 모드에서 허용되지 않는 모델이면 기본 Codex 모델로 교정
          if (am?.providerId === "openai" && openaiIsOAuth && !CHATGPT_MODELS.includes(am.model)) {
            am = { providerId: "openai", model: chooseChatGptModel(CHATGPT_MODELS, am.model) };
          }
          setActiveModel(am);
        }
        // 구독 연결이 살아 있으면 백엔드 카탈로그에서 실제 모델 목록을 백그라운드로 갱신
        if (openaiIsOAuth && savedOpenai?.status === "connected" && savedOpenai.credential) {
          void refreshChatGptModels(savedOpenai.credential);
        }
        if (Array.isArray(s.sessions) && s.sessions.length > 0) {
          loaded = s.sessions;
          loadedActive =
            s.sessions.find((x) => x.id === s.activeSessionId) ??
            s.sessions.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
        } else if (Array.isArray(s.messages) || s.doc || s.graph) {
          // v1(단일 대화) 저장분 → 세션 하나로 마이그레이션
          const first = newSession();
          first.messages = Array.isArray(s.messages) ? s.messages.filter((m) => !m.pending) : [];
          first.doc = s.doc ?? null;
          first.graph = s.graph ?? null;
          loaded = [first];
          loadedActive = first;
        }
      }
    } catch {
      /* 손상된 저장분 무시 */
    }
    if (!loaded || !loadedActive) {
      const first = newSession();
      loaded = [first];
      loadedActive = first;
    }
    setSessions(loaded);
    loadSession(loadedActive);
    setHydrated(true);
  }, [loadSession, refreshChatGptModels]);

  /* 라이브 상태 → 활성 세션 동기화 (참조가 같으면 그대로 두어 updatedAt 오염 방지) */
  useEffect(() => {
    if (!hydrated) return;
    setSessions((ss) => {
      const cur = ss.find((s) => s.id === activeSessionId);
      if (
        !cur ||
        (cur.messages === messages &&
          cur.doc === doc &&
          cur.graph === graph &&
          (cur.spec ?? null) === spec &&
          (cur.history ?? EMPTY_HISTORY) === history)
      )
        return ss;
      return ss.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages, doc, graph, spec, history, updatedAt: Date.now() }
          : s,
      );
    });
  }, [hydrated, activeSessionId, messages, doc, graph, spec, history]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const state: PersistedState = { providers, activeModel, sessions, activeSessionId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 저장 실패(용량 등) 무시 */
    }
  }, [hydrated, providers, activeModel, sessions, activeSessionId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* ---------- ChatGPT OAuth 콜백 자동 완료 ----------
   * 1455 리스너가 ?oauth=openai&code=…&state=… 로 리디렉션해 오면
   * localStorage에 저장해 둔 PKCE verifier로 토큰을 교환하고 바로 연결한다. */
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") !== "openai") return;

    // URL은 즉시 정리 (새로고침 시 재시도 방지)
    window.history.replaceState({}, "", window.location.pathname);

    const code = params.get("code");
    const state = params.get("state");
    const pending = loadPendingAuth();

    const fail = (message: string) => {
      setConnectError({ providerId: "openai", message });
      setDialogOpen(true);
    };

    if (!code) return fail("리디렉션에 인가 코드가 없습니다. 로그인을 다시 시도해 주세요.");
    if (!pending) return fail("로그인 세션을 찾을 수 없습니다. 'ChatGPT로 로그인'을 다시 눌러 주세요.");
    if (state && state !== pending.state) return fail("state 값이 일치하지 않습니다. 로그인을 다시 시도해 주세요.");

    (async () => {
      try {
        const cred = await exchangeCode(code, pending.verifier);
        clearPendingAuth();
        const label = cred.email ? `ChatGPT 구독 · ${cred.email}` : "ChatGPT 구독";
        setProviders((ps) =>
          ps.map((p) =>
            p.id === "openai"
              ? { ...p, status: "connected", credential: JSON.stringify(cred), keyMask: label, models: CHATGPT_MODELS }
              : p,
          ),
        );
        setActiveModel((am) => am ?? { providerId: "openai", model: chooseChatGptModel(CHATGPT_MODELS) });
        setDialogOpen(true); // 연결됨 상태를 바로 보여준다
        void refreshChatGptModels(JSON.stringify(cred)); // 백엔드 카탈로그로 모델 목록 갱신
      } catch (err) {
        fail(err instanceof Error ? err.message : "토큰 교환에 실패했습니다.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /* 다른 탭(OAuth 리디렉션 탭 등)에서 연결이 완료되면 프로바이더 상태를 동기화 */
  useEffect(() => {
    if (!hydrated) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as Partial<PersistedState>;
        if (Array.isArray(s.providers)) setProviders(s.providers);
        if (s.activeModel !== undefined) setActiveModel(s.activeModel ?? null);
      } catch {
        /* 무시 */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrated]);

  const connectedCount = providers.filter((p) => p.status === "connected").length;

  /* ---------- 모델 연결 ---------- */

  const handleConnect = useCallback(async (providerId: string, credential: string) => {
    setConnectError(null);
    setProviders((ps) =>
      ps.map((p) => (p.id === providerId ? { ...p, status: "connecting" } : p)),
    );

    const result = await validateConnection(providerId, credential);

    if (!result.ok) {
      setProviders((ps) =>
        ps.map((p) => (p.id === providerId ? { ...p, status: "disconnected" } : p)),
      );
      setConnectError({ providerId, message: result.error ?? "연결에 실패했습니다." });
      return;
    }

    setProviders((ps) =>
      ps.map((p) =>
        p.id === providerId
          ? {
              ...p,
              status: "connected",
              credential,
              models: result.models?.length ? result.models : p.models,
              keyMask: p.local
                ? undefined
                : `${credential.slice(0, 7)}••••••••${credential.slice(-4)}`,
            }
          : p,
      ),
    );
    // 활성 모델이 없으면 방금 연결한 프로바이더의 기본 모델을 선택
    setActiveModel((am) => {
      if (am) return am;
      const models = result.models?.length
        ? result.models
        : INITIAL_PROVIDERS.find((x) => x.id === providerId)?.models ?? [];
      return models[0] ? { providerId, model: models[0] } : am;
    });
  }, []);

  /** ChatGPT 구독 OAuth 로그인 성공 (다이얼로그에서 토큰 교환 완료 후 호출) */
  const handleOAuthConnected = useCallback(
    (providerId: string, credential: string, label: string, models: string[]) => {
      setConnectError(null);
      setProviders((ps) =>
        ps.map((p) =>
          p.id === providerId
            ? { ...p, status: "connected", credential, keyMask: label, models }
            : p,
        ),
      );
      setActiveModel((am) => {
        if (providerId !== "openai") {
          return am ? am : models[0] ? { providerId, model: models[0] } : am;
        }
        if (am?.providerId === "openai") {
          return { providerId, model: chooseChatGptModel(models, am.model) };
        }
        return am ?? (models[0] ? { providerId, model: chooseChatGptModel(models) } : am);
      });
      if (providerId === "openai") void refreshChatGptModels(credential);
    },
    [refreshChatGptModels],
  );

  const handleDisconnect = useCallback((providerId: string) => {
    setProviders((ps) =>
      ps.map((p) =>
        p.id === providerId
          ? {
              ...p,
              status: "disconnected",
              credential: undefined,
              keyMask: undefined,
              // OAuth 연결이 모델 목록을 덮어썼을 수 있으므로 카탈로그로 복원
              models: INITIAL_PROVIDERS.find((x) => x.id === providerId)?.models ?? p.models,
            }
          : p,
      ),
    );
    setActiveModel((am) => (am?.providerId === providerId ? null : am));
    setConnectError(null);
  }, []);

  const handleSelectModel = useCallback((providerId: string, model: string) => {
    setActiveModel({ providerId, model });
  }, []);

  /* ---------- 대화 (실제 LLM 호출) ---------- */

  const handleSend = useCallback(
    async (text: string) => {
      if (streaming || !activeModel) return;
      const provider = providers.find((p) => p.id === activeModel.providerId);
      if (!provider || provider.status !== "connected" || !provider.credential) {
        setDialogOpen(true);
        return;
      }

      const assistantId = nextId();
      const history: ChatTurn[] = messages
        .filter((m) => m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((ms) => [
        ...ms,
        { id: nextId(), role: "user", content: text },
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let full = "";
      let shown = 0;
      let revealTimer: ReturnType<typeof setTimeout> | undefined;
      let revealDone: (() => void) | undefined;

      // 프로바이더가 큰 청크를 한 번에 보내도 대화 텍스트는 한 글자씩 공개한다.
      const reveal = () => {
        if (revealTimer || controller.signal.aborted) return;
        const tick = () => {
          const visible = visibleText(full);
          if (shown < visible.length) {
            shown += 1;
            setMessages((ms) =>
              ms.map((m) =>
                m.id === assistantId ? { ...m, content: visible.slice(0, shown) } : m,
              ),
            );
            revealTimer = setTimeout(tick, 10);
          } else {
            revealTimer = undefined;
            revealDone?.();
            revealDone = undefined;
          }
        };
        tick();
      };

      try {
        await streamChat({
          providerId: provider.id,
          model: activeModel.model,
          credential: provider.credential,
          system: buildSystemPrompt(doc, spec),
          messages: [...history, { role: "user", content: text }],
          signal: controller.signal,
          onCredentialRefresh: (newCred) => {
            setProviders((ps) =>
              ps.map((p) => (p.id === provider.id ? { ...p, credential: newCred } : p)),
            );
          },
          onText: (delta) => {
            full += delta;
            const progress = generationProgress(full) ?? undefined;
            reveal();
            setMessages((ms) =>
              ms.map((m) =>
                m.id === assistantId ? { ...m, progress } : m,
              ),
            );
          },
        });

        if (shown < visibleText(full).length) {
          await new Promise<void>((resolve) => {
            revealDone = resolve;
            reveal();
          });
        }

        // 완료: PRD 페이로드 추출 → 문서/연결도 갱신
        let payload = extractPayload(full);
        const questions = (!payload && extractQuestions(full)) || undefined;
        const finalText =
          visibleText(full).trim() ||
          (payload ? "문서를 업데이트했어요. 오른쪽 패널에서 확인해 주세요." : "…");

        setMessages((ms) =>
          ms.map((m) =>
            m.id === assistantId
              ? { ...m, content: finalText, pending: false, progress: undefined, questions }
              : m,
          ),
        );

        // 첫 생성인데 모델이 프로토콜을 안 따라 문서가 없으면, 조용한 2차 요청으로 JSON만 회수.
        // ponytail: 선택지 페이로드·물음표로 인터뷰 질문 턴과 프로토콜 미준수를 구분 — 오판해도 다음 턴에서 자연 회복
        const askedQuestion = !!questions || /[?？]/.test(finalText);
        if (!payload && doc === null && !askedQuestion && !controller.signal.aborted) {
          let jsonOnly = "";
          try {
            await streamChat({
              providerId: provider.id,
              model: activeModel.model,
              credential: provider.credential,
              system: buildSystemPrompt(null, null),
              messages: [
                ...history,
                { role: "user", content: text },
                { role: "assistant", content: full },
                {
                  role: "user",
                  content:
                    "방금 논의한 제품의 전체 PRD를 출력 프로토콜에 따라 지금 출력해. 첫 줄에 정확히 <<<PRD_JSON>>> 마커를 쓰고, 다음 줄부터 스키마에 맞는 JSON만 출력해. 다른 텍스트는 절대 쓰지 마.",
                },
              ],
              signal: controller.signal,
              onText: (delta) => {
                jsonOnly += delta;
                const progress = generationProgress(jsonOnly);
                if (progress)
                  setMessages((ms) =>
                    ms.map((m) => (m.id === assistantId ? { ...m, progress } : m)),
                  );
              },
            });
            payload = extractPayload(jsonOnly);
          } catch {
            /* 재시도 실패는 조용히 무시 — 사용자는 다음 턴에서 이어갈 수 있다 */
          }
          setMessages((ms) =>
            ms.map((m) => (m.id === assistantId ? { ...m, progress: undefined } : m)),
          );
        }

        if (payload) {
          const p = payload;
          // ponytail: 초안 턴(첫 PRD 생성)에는 명세를 적용하지 않는다 — 모델이 "만들까요?" 물어놓고
          // 같은 턴에 spec을 내보내도 코드에서 막아 PRD만 남긴다. 사용자가 즉시 전체 생성을 명시한 경우만 예외.
          const firstDraft = doc === null;
          const wantsAllNow = /만들어|다\s*만들|전부|알아서|바로|한\s*번에|완성/.test(text);
          const applySpec = !!p.spec && (!firstDraft || wantsAllNow);
          const docChanged = !doc || !samePrdContent(doc, p.doc);
          // 갱신 직전 버전을 히스토리에 스냅샷 (doc/graph/spec은 이 턴 시작 시점 값)
          if (doc) setHistory((h) => pushSnapshot(h, doc, graph, spec));
          if (docChanged) setDoc((d) => ({ ...p.doc, version: (d?.version ?? 0) + 1 }));
          if (p.graph) setGraph(p.graph);
          if (applySpec) setSpec(p.spec ?? null);
          if (docChanged && tab !== "prd") setDocPulse(true);
        }
      } catch (err) {
        const aborted =
          controller.signal.aborted ||
          (err instanceof Error && err.name === "AbortError");
        if (aborted) {
          // 중단: 부분 응답을 남기거나, 비어 있으면 말풍선 제거
          setMessages((ms) =>
            ms.flatMap((m) => {
              if (m.id !== assistantId) return [m];
              const partial = visibleText(full).trim();
              return partial
                ? [{ ...m, content: `${partial}\n\n(중단됨)`, pending: false, progress: undefined }]
                : [];
            }),
          );
        } else {
          const msg = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
          setMessages((ms) =>
            ms.map((m) =>
              m.id === assistantId
                ? { ...m, content: msg, pending: false, error: true, progress: undefined }
                : m,
            ),
          );
        }
      } finally {
        if (revealTimer) clearTimeout(revealTimer);
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [streaming, activeModel, providers, messages, doc, graph, spec, tab],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /* ---------- 문서 보관함 (다중 세션) ---------- */

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    const cur = sessions.find((s) => s.id === activeSessionId);
    if (cur && cur.messages.length === 0 && !cur.doc) {
      // 현재 세션이 이미 빈 문서면 새로 만들지 않고 재사용
      loadSession(cur);
      return;
    }
    const fresh = newSession();
    setSessions((ss) => [...ss, fresh]);
    loadSession(fresh);
  }, [sessions, activeSessionId, loadSession]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) return;
      const target = sessions.find((s) => s.id === id);
      if (!target) return;
      abortRef.current?.abort();
      setStreaming(false);
      loadSession(target);
    },
    [sessions, activeSessionId, loadSession],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      const target = sessions.find((s) => s.id === id);
      if (!target) return;
      const empty = target.messages.length === 0 && !target.doc;
      if (!empty && !window.confirm(`"${sessionTitle(target)}" 문서를 삭제할까요?`)) return;

      const rest = sessions.filter((s) => s.id !== id);
      if (id === activeSessionId) {
        abortRef.current?.abort();
        setStreaming(false);
        const next =
          rest.length > 0
            ? rest.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
            : newSession();
        if (rest.length === 0) rest.push(next);
        loadSession(next);
      }
      setSessions(rest);
    },
    [sessions, activeSessionId, loadSession],
  );

  /* ---------- 버전 히스토리 / 템플릿 ---------- */

  const handleRestoreVersion = useCallback(
    (snap: DocSnapshot) => {
      if (!window.confirm(`v${snap.version}으로 복원할까요? 현재 버전도 히스토리에 남습니다.`)) return;
      if (doc) setHistory((h) => pushSnapshot(h, doc, graph, spec));
      setDoc({ ...snap.doc, version: (doc?.version ?? 0) + 1 });
      setGraph(snap.graph);
      setSpec(snap.spec ?? null);
      setTab("prd");
      setDocPulse(true);
    },
    [doc, graph, spec],
  );

  const handleApplyTemplate = useCallback(
    (t: PrdTemplate) => {
      abortRef.current?.abort();
      setStreaming(false);
      const fresh = newSession();
      fresh.doc = structuredClone(t.doc);
      setSessions((ss) => [...ss, fresh]);
      loadSession(fresh);
    },
    [loadSession],
  );

  const handleTabChange = useCallback((t: WorkspaceTab) => {
    setTab(t);
    if (t === "prd") setDocPulse(false);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <NavRail
        connectedCount={connectedCount}
        panel={panel}
        onTogglePanel={(p) => setPanel((cur) => (cur === p ? null : p))}
        onOpenModelDialog={() => setDialogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {panel === "archive" && (
        <ArchivePanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={handleSelectSession}
          onDelete={handleDeleteSession}
          onNew={handleNewChat}
        />
      )}
      {panel === "history" && (
        <HistoryPanel
          history={history}
          currentVersion={doc?.version ?? null}
          onRestore={handleRestoreVersion}
        />
      )}
      {panel === "templates" && <TemplatePanel onApply={handleApplyTemplate} />}
      <ChatPanel
        messages={messages}
        streaming={streaming}
        activeModel={activeModel}
        onSend={handleSend}
        onStop={handleStop}
        onNewChat={handleNewChat}
        onOpenModelDialog={() => setDialogOpen(true)}
      />
      <Workspace
        doc={doc}
        graph={graph}
        spec={spec}
        tab={tab}
        onTabChange={handleTabChange}
        docPulse={docPulse}
        generating={streaming}
        onDocChange={(updater) => setDoc((d) => (d ? updater(d) : d))}
        onSpecChange={(updater) => setSpec((s) => (s ? updater(s) : s))}
        onCreateSpec={() => handleSend("이 PRD를 바탕으로 기능명세서를 바로 작성해줘.")}
      />
      <ModelDialog
        open={dialogOpen}
        providers={providers}
        activeModel={activeModel}
        connectError={connectError}
        onClose={() => {
          setDialogOpen(false);
          setConnectError(null);
        }}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSelectModel={handleSelectModel}
        onOAuthConnected={handleOAuthConnected}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
