"use client";

import {
  AlertCircle,
  ArrowUp,
  Cable,
  Check,
  ChevronDown,
  Loader2,
  Square,
  SquarePen,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatInterviewAnswers, numberedQuestionTexts } from "@/lib/llm/parse";
import { SUGGESTIONS } from "@/lib/mock";
import type { ActiveModel, Message } from "@/lib/types";

type ChatPanelProps = {
  messages: Message[];
  streaming: boolean;
  activeModel: ActiveModel;
  onSend: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onOpenModelDialog: () => void;
};

function MessageBubble({
  message,
  picks,
  extraAnswer,
  onTogglePick,
  onExtraAnswer,
  onSubmitPicks,
}: {
  message: Message;
  /** 인터뷰 선택 상태 — 질문 라벨 → 선택한 옵션들 (마지막 메시지에서만 전달됨) */
  picks?: Record<string, string[]>;
  extraAnswer?: string;
  onTogglePick?: (q: string, option: string) => void;
  onExtraAnswer?: (answer: string) => void;
  onSubmitPicks?: () => void;
}) {
  const questionTexts = message.questions
    ? numberedQuestionTexts(message.content, message.questions.length) ??
      message.questions.map((question) => question.q)
    : [];

  if (message.role === "user") {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-panel3 px-3.5 py-2.5 text-[13px] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.error) {
    return (
      <div className="msg-in flex gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-danger/12">
          <AlertCircle size={12} className="text-danger" />
        </div>
        <div className="min-w-0 whitespace-pre-wrap pt-0.5 text-[13px] leading-relaxed text-danger/90">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="msg-in flex gap-2.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15">
        <Sparkles size={12} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {!message.questions && (
          <div
            className={`whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90 ${
              message.pending && !message.progress ? "stream-caret" : ""
            }`}
          >
            {message.content}
          </div>
        )}
        {message.progress && (
          <div className="mt-2.5 flex flex-col gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-2.5">
            {message.progress.done.map((label) => (
              <div key={label} className="flex items-center gap-2 text-[11.5px] text-faint">
                <Check size={11} className="shrink-0 text-ok" />
                {label}
              </div>
            ))}
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-accent">
              <Loader2 size={11} className="shrink-0 animate-spin" />
              {message.progress.current} 작성 중…
            </div>
          </div>
        )}
        {message.questions &&
        picks &&
        extraAnswer !== undefined &&
        onTogglePick &&
        onExtraAnswer &&
        onSubmitPicks ? (
          <div className="mt-2.5 flex flex-col gap-2.5 rounded-lg border border-line bg-panel2/60 p-3">
            <div className="text-[12px] font-medium text-ink">하나씩 답해 주세요</div>
            {message.questions.map((question, index) => (
              <div key={question.q}>
                <div className="mb-1.5 text-[12px] font-medium leading-relaxed text-ink/90">
                  {index + 1}. {questionTexts[index]}
                  {question.multi && <span className="ml-1 text-faint">· 복수 선택</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {question.options.map((option) => {
                    const active = (picks[question.q] ?? []).includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onTogglePick(question.q, option)}
                        aria-pressed={active}
                        className={`w-full rounded-md border px-3 py-2 text-left text-[11.5px] leading-relaxed transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                            active
                              ? "border-accent bg-accent/15 font-medium text-accent"
                              : "border-line bg-panel2 text-ink/90 hover:border-accent/50 hover:bg-panel3"
                          }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <label className="mt-0.5 text-[11px] font-medium text-muted" htmlFor={`extra-${message.id}`}>
              추가 요구사항
            </label>
            <textarea
              id={`extra-${message.id}`}
              rows={2}
              value={extraAnswer}
              onChange={(e) => onExtraAnswer(e.target.value)}
              placeholder="선택지에 없거나 덧붙일 내용을 입력하세요"
              className="w-full resize-none rounded-md border border-line bg-panel px-3 py-2 text-[11.5px] leading-relaxed text-ink
                placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
            <div className="mt-0.5 flex items-center justify-between">
              <span className="text-[10.5px] text-faint">답하지 않은 항목은 합리적인 가정으로 채웁니다</span>
              <button
                type="button"
                onClick={onSubmitPicks}
                disabled={Object.keys(picks).length === 0 && !extraAnswer.trim()}
                className="rounded-md bg-accent px-3 py-1.5 text-[11.5px] font-medium text-[#1a1204]
                  transition-all hover:bg-accentstrong disabled:opacity-30
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                답변 보내기
                {Object.keys(picks).length > 0 && ` (${Object.keys(picks).length}/${message.questions.length})`}
              </button>
            </div>
          </div>
        ) : message.questions ? (
          <div className="flex flex-col gap-2 text-[12px] leading-relaxed text-ink/90">
            {message.questions.map((question, index) => (
              <div key={question.q}>
                {index + 1}. {questionTexts[index]}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pb-16">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15">
        <Sparkles size={20} className="text-accent" />
      </div>
      <h2 className="text-[15px] font-semibold">무엇을 만들까요?</h2>
      <p className="mt-1 text-center text-[12px] leading-relaxed text-muted">
        아이디어를 설명하면 PRD 문서와
        <br />
        기능 연결도를 만들어 드려요.
      </p>
      <div className="mt-5 flex w-full max-w-[280px] flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="rounded-lg border border-line bg-panel2 px-3.5 py-2.5 text-left transition-colors
              hover:border-linestrong hover:bg-panel3
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <div className="text-[12.5px] font-medium">{s.title}</div>
            <div className="mt-0.5 line-clamp-1 text-[11.5px] text-faint">
              {s.prompt}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  streaming,
  activeModel,
  onSend,
  onStop,
  onNewChat,
  onOpenModelDialog,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);

  // 사용자가 위로 올려 읽는 동안에는 스트리밍이 스크롤을 빼앗지 않는다.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || streaming || !activeModel) return;
    onSend(text);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  /* 인터뷰 선택 — 채팅 안에서 선택하고 바로 전송. 같은 옵션 재클릭은 해제.
   * multi 질문은 여러 개 누적, 단일 질문은 교체. */
  const [draft, setDraft] = useState<{
    messageId: string;
    picks: Record<string, string[]>;
    extra: string;
  }>({ messageId: "", picks: {}, extra: "" });
  const lastMessage = messages[messages.length - 1];
  const lastId = lastMessage?.id ?? "";
  const currentDraft =
    draft.messageId === lastId ? draft : { messageId: lastId, picks: {}, extra: "" };
  const { picks, extra: extraAnswer } = currentDraft;

  const togglePick = (q: string, option: string) => {
    const multi = lastMessage?.questions?.find((x) => x.q === q)?.multi ?? false;
    setDraft((previous) => {
      const active = previous.messageId === lastId ? previous : currentDraft;
      const cur = active.picks[q] ?? [];
      let next: string[];
      if (cur.includes(option)) next = cur.filter((o) => o !== option);
      else next = multi ? [...cur, option] : [option];
      if (next.length === 0) {
        const picks = { ...active.picks };
        delete picks[q];
        return { ...active, picks };
      }
      return { ...active, picks: { ...active.picks, [q]: next } };
    });
  };

  const submitPicks = () => {
    if (streaming || !activeModel || !lastMessage?.questions) return;
    const answer = formatInterviewAnswers(lastMessage.questions, picks, extraAnswer);
    if (!answer) return;
    onSend(answer);
    // 메시지가 바뀌면 messageId가 다른 draft는 자동으로 무시한다.
  };

  return (
    <section className="flex w-[400px] shrink-0 flex-col border-r border-line bg-panel">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">대화</span>
          {streaming && (
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10.5px] font-medium text-accent">
              생성 중
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onNewChat}
          title="새 대화"
          aria-label="새 대화"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors
            hover:bg-panel2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <SquarePen size={15} />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <EmptyState onPick={(p) => (activeModel ? onSend(p) : onOpenModelDialog())} />
        ) : (
          <div className="flex flex-col gap-5 px-4 py-5">
            {messages.map((m, i) => {
              // 선택지는 마지막 메시지에서만 활성 — 지난 질문 라운드는 비활성
              const interactive = i === messages.length - 1 && !streaming;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  picks={interactive ? picks : undefined}
                  extraAnswer={interactive ? extraAnswer : undefined}
                  onTogglePick={interactive ? togglePick : undefined}
                  onExtraAnswer={
                    interactive
                      ? (extra) => setDraft({ ...currentDraft, extra })
                      : undefined
                  }
                  onSubmitPicks={interactive ? submitPicks : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-line p-3">
        {activeModel ? (
          <div className="rounded-xl border border-line bg-panel2 transition-colors focus-within:border-accent/50">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="만들고 싶은 제품을 설명해 주세요…"
              className="max-h-[120px] w-full resize-none bg-transparent px-3.5 pt-3 text-[13px] leading-relaxed
                placeholder:text-faint/80 focus:outline-none"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              {/* Model chip — 클릭하면 연결 다이얼로그 */}
              <button
                type="button"
                onClick={onOpenModelDialog}
                title="모델 변경"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-muted
                  transition-colors hover:bg-panel3 hover:text-ink
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                {activeModel.model}
                <ChevronDown size={11} className="text-faint" />
              </button>
              {streaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="생성 중단"
                  title="생성 중단"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-linestrong text-muted
                    transition-colors hover:border-danger/60 hover:text-danger
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!input.trim()}
                  aria-label="보내기"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[#1a1204]
                    transition-all hover:bg-accentstrong disabled:opacity-30
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* 모델 미연결 상태 */
          <button
            type="button"
            onClick={onOpenModelDialog}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-linestrong
              bg-panel2 px-4 py-3.5 text-[12.5px] text-muted transition-colors
              hover:border-accent/50 hover:text-accent
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <Cable size={14} />
            대화를 시작하려면 모델을 연결하세요
          </button>
        )}
      </div>
    </section>
  );
}
