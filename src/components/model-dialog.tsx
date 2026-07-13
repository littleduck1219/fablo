"use client";

import { Cable, Check, ExternalLink, Loader2, Unplug, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  parseCodexAuthJson,
  getDeviceAuthStatus,
  startDeviceAuth,
  CHATGPT_MODELS,
  SERVER_CHATGPT_CREDENTIAL,
  type DeviceAuthRequest,
} from "@/lib/llm/openai-oauth";
import type { ActiveModel, Provider } from "@/lib/types";

type ModelDialogProps = {
  open: boolean;
  providers: Provider[];
  activeModel: ActiveModel;
  connectError: { providerId: string; message: string } | null;
  onClose: () => void;
  onConnect: (providerId: string, credential: string) => void;
  onDisconnect: (providerId: string) => void;
  onSelectModel: (providerId: string, model: string) => void;
  /** OAuth(ChatGPT 구독) 로그인 성공 시 */
  onOAuthConnected: (
    providerId: string,
    credential: string,
    label: string,
    models: string[],
  ) => void;
};

export function ModelDialog({
  open,
  providers,
  activeModel,
  connectError,
  onClose,
  onConnect,
  onDisconnect,
  onSelectModel,
  onOAuthConnected,
}: ModelDialogProps) {
  const [selectedId, setSelectedId] = useState(providers[0]?.id ?? "");
  const [credential, setCredential] = useState("");

  // OpenAI 인증 방식: API 키 ↔ ChatGPT 구독 로그인
  const [authMode, setAuthMode] = useState<"key" | "chatgpt">("key");
  const [deviceReq, setDeviceReq] = useState<DeviceAuthRequest | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const selected = providers.find((p) => p.id === selectedId) ?? providers[0];
  const resetOAuth = () => {
    setDeviceReq(null);
    setOauthBusy(false);
    setOauthError(null);
    setImportText("");
  };

  // 다이얼로그를 열 때: 에러가 난 프로바이더 > 활성 모델의 프로바이더 순으로 기본 선택
  useEffect(() => {
    if (open) {
      setSelectedId(
        connectError?.providerId ?? activeModel?.providerId ?? providers[0]?.id ?? "",
      );
      setCredential("");
      setAuthMode(connectError?.providerId === "openai" ? "chatgpt" : "key");
      resetOAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !deviceReq) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await getDeviceAuthStatus(deviceReq.loginId);
        if (!active) return;
        if (result.status === "complete") {
          setDeviceReq(null);
          setOauthBusy(false);
          onConnect("openai", SERVER_CHATGPT_CREDENTIAL);
          return;
        }
        if (result.status === "error" || result.status === "cancelled") {
          setDeviceReq(null);
          setOauthBusy(false);
          setOauthError(result.error || "로그인이 완료되지 않았습니다.");
          return;
        }
        timer = setTimeout(poll, 1500);
      } catch (error) {
        if (!active) return;
        setDeviceReq(null);
        setOauthBusy(false);
        setOauthError(error instanceof Error ? error.message : "로그인 상태를 확인하지 못했습니다.");
      }
    };
    timer = setTimeout(poll, 1000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [deviceReq, onConnect, open]);

  if (!open || !selected) return null;

  const canConnect = selected.local
    ? credential.trim().length > 0
    : credential.trim().length >= 8;

  const startChatGptLogin = async () => {
    setOauthError(null);
    setOauthBusy(true);
    try {
      setDeviceReq(await startDeviceAuth());
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "디바이스 로그인을 시작하지 못했습니다.");
      setOauthBusy(false);
    }
  };

  /** Codex CLI auth.json 텍스트로 연결 (Cloudflare 우회 경로) */
  const importCodexAuth = (text: string) => {
    setOauthError(null);
    try {
      const cred = parseCodexAuthJson(text);
      const label = cred.email ? `ChatGPT 구독 · ${cred.email}` : "ChatGPT 구독 (Codex 가져오기)";
      onOAuthConnected(selected.id, JSON.stringify(cred), label, CHATGPT_MODELS);
      resetOAuth();
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "가져오기에 실패했습니다.");
    }
  };

  const importCodexFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => importCodexAuth(String(reader.result ?? ""));
    reader.onerror = () => setOauthError("파일을 읽지 못했습니다.");
    reader.readAsText(file);
  };

  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="모델 연결"
    >
      <div className="dialog-in flex w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-linestrong bg-panel2 shadow-2xl">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Cable size={15} className="text-accent" />
            모델 연결
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors
              hover:bg-panel3 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-[340px]">
          {/* Provider list */}
          <div className="w-[200px] shrink-0 border-r border-line p-2">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setCredential("");
                  setAuthMode("key");
                  resetOAuth();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                  ${
                    p.id === selected.id
                      ? "bg-panel3 text-ink"
                      : "text-muted hover:bg-panel3/60 hover:text-ink"
                  }`}
              >
                <span className="truncate">{p.name}</span>
                <span
                  className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                    p.status === "connected"
                      ? "bg-ok"
                      : p.status === "connecting"
                        ? "bg-accent"
                        : "bg-faint/60"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">{selected.name}</h3>
                {selected.status === "connected" && (
                  <span className="flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] text-ok">
                    <Check size={11} /> 연결됨
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {selected.local
                  ? "로컬 런타임 엔드포인트로 연결합니다. API 키가 필요하지 않아요."
                  : "자격 증명은 이 브라우저에만 저장되며 외부 서버에 저장되지 않습니다."}
              </p>
            </div>

            {selected.status === "connected" ? (
              <>
                {/* Model choice */}
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                    사용할 모델
                  </div>
                  <div className="flex flex-col gap-1">
                    {selected.models.map((m) => {
                      const isActive =
                        activeModel?.providerId === selected.id &&
                        activeModel.model === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => onSelectModel(selected.id, m)}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 font-mono text-[12px] transition-colors
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                            ${
                              isActive
                                ? "border-accent/50 bg-accent/10 text-accentstrong"
                                : "border-line text-muted hover:border-linestrong hover:text-ink"
                            }`}
                        >
                          {m}
                          {isActive && <Check size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                  <span className="font-mono text-[11px] text-faint">
                    {selected.local ? selected.credential ?? "" : selected.keyMask}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDisconnect(selected.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted
                      transition-colors hover:border-danger/50 hover:text-danger
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                  >
                    <Unplug size={13} /> 연결 해제
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* OpenAI: 인증 방식 선택 */}
                {selected.id === "openai" && (
                  <div className="flex items-center gap-0.5 self-start rounded-lg border border-line bg-panel p-0.5">
                    {(
                      [
                        { key: "key", label: "API 키" },
                        { key: "chatgpt", label: "ChatGPT 구독 로그인" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setAuthMode(m.key);
                          setOauthError(null);
                        }}
                        className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                          ${
                            authMode === m.key
                              ? "bg-panel3 text-ink"
                              : "text-muted hover:text-ink"
                          }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}

                {selected.id === "openai" && authMode === "chatgpt" ? (
                  /* ---------- ChatGPT 구독 디바이스 연결 ---------- */
                  <div className="flex flex-1 flex-col gap-3">
                    <p className="text-[12px] leading-relaxed text-muted">
                      ChatGPT Plus/Pro 구독으로 로그인합니다. API 키 없이 구독 요금제의
                      사용량으로 모델을 호출해요.
                    </p>

                    {!deviceReq ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={oauthBusy}
                          onClick={startChatGptLogin}
                          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-[#1a1204]
                            transition-colors hover:bg-accentstrong disabled:opacity-40
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          {oauthBusy ? <Loader2 size={13} className="animate-spin" /> : <Cable size={13} />}
                          디바이스로 연결
                        </button>
                        <button
                          type="button"
                          onClick={() => onConnect(selected.id, SERVER_CHATGPT_CREDENTIAL)}
                          className="flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2.5 text-[12.5px] font-medium text-muted
                            transition-colors hover:border-linestrong hover:text-ink
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          <Cable size={13} />
                          저장된 서버 로그인 사용
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg border border-line bg-panel px-4 py-4 text-center">
                          <div className="text-[11px] text-faint">OpenAI 페이지에서 입력할 코드</div>
                          <div className="my-2 font-mono text-[24px] font-bold tracking-[0.18em] text-accentstrong">
                            {deviceReq.userCode}
                          </div>
                          <a
                            href={deviceReq.verificationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accentstrong"
                          >
                            <ExternalLink size={12} /> OpenAI 디바이스 연결 열기
                          </a>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[12px] text-muted">
                          <Loader2 size={13} className="animate-spin text-accent" /> 승인 대기 중…
                        </div>
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={startChatGptLogin}
                            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12px] font-medium text-muted
                              transition-colors hover:border-linestrong hover:text-ink
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          >
                            새 코드 발급
                          </button>
                        </div>
                      </>
                    )}

                    {(oauthError || connectError?.providerId === selected.id) && (
                      <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] leading-relaxed text-danger">
                        {oauthError ?? connectError?.message}
                      </p>
                    )}

                    {/* Cloudflare 등으로 로그인이 막힐 때: Codex CLI 토큰 재사용 */}
                    <div className="mt-auto border-t border-line pt-3">
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                        로그인이 안 되나요? — Codex CLI 로그인 재사용
                      </div>
                      <p className="mb-2 text-[11.5px] leading-relaxed text-faint">
                        Codex CLI나 VSCode Codex에 로그인한 적이 있다면{" "}
                        <span className="font-mono text-[10.5px]">~/.codex/auth.json</span> 내용을
                        붙여넣거나 파일을 선택하세요. Cloudflare 확인 없이 바로 연결됩니다.
                      </p>
                      <textarea
                        rows={2}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder='{"tokens":{"access_token":"…'
                        spellCheck={false}
                        className="w-full resize-none rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[10.5px] text-ink
                          placeholder:text-faint/60 focus:border-accent/60 focus:outline-none"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!importText.trim()}
                          onClick={() => importCodexAuth(importText)}
                          className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors
                            hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          붙여넣은 내용으로 연결
                        </button>
                        <label
                          className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition-colors
                            hover:border-linestrong hover:text-ink"
                        >
                          파일 선택…
                          <input
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) importCodexFile(f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ---------- API 키 / 엔드포인트 ---------- */
                  <>
                    <div>
                      <label
                        htmlFor="credential"
                        className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-faint"
                      >
                        {selected.local ? "엔드포인트 URL" : "API 키"}
                      </label>
                      <input
                        id="credential"
                        type={selected.local ? "text" : "password"}
                        value={credential}
                        onChange={(e) => setCredential(e.target.value)}
                        placeholder={
                          selected.local ? "http://localhost:11434" : "sk-..."
                        }
                        spellCheck={false}
                        autoComplete="off"
                        className="w-full rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[12px] text-ink
                          placeholder:text-faint/70 focus:border-accent/60 focus:outline-none"
                      />
                    </div>

                    {connectError?.providerId === selected.id && (
                      <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] leading-relaxed text-danger">
                        {connectError.message}
                      </p>
                    )}

                    <div className="mt-auto flex justify-end border-t border-line pt-3">
                      <button
                        type="button"
                        disabled={!canConnect || selected.status === "connecting"}
                        onClick={() => onConnect(selected.id, credential)}
                        className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-[#1a1204]
                          transition-colors hover:bg-accentstrong disabled:cursor-not-allowed disabled:opacity-40
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        {selected.status === "connecting" ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> 연결 중…
                          </>
                        ) : (
                          <>
                            <Cable size={13} /> 연결하기
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
