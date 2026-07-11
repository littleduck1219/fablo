"use client";

import { FilePlus2, Trash2 } from "lucide-react";
import type { Session } from "@/lib/types";

type ArchivePanelProps = {
  sessions: Session[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
};

export function sessionTitle(s: Session) {
  return (
    s.doc?.title ||
    s.messages.find((m) => m.role === "user")?.content.slice(0, 60) ||
    "새 문서"
  );
}

export function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return new Date(ts).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function ArchivePanel({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNew,
}: ArchivePanelProps) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-ink">문서 보관함</h2>
        <button
          type="button"
          onClick={onNew}
          title="새 문서"
          aria-label="새 문서"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors
            hover:bg-panel2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <FilePlus2 size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sorted.map((s) => {
          const active = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              className={`group relative mb-1 rounded-lg transition-colors ${
                active ? "bg-panel3" : "hover:bg-panel2"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="w-full rounded-lg px-3 py-2.5 text-left focus-visible:outline-none
                  focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <div
                  className={`truncate pr-6 text-[13px] leading-snug ${
                    active ? "font-medium text-ink" : "text-ink/90"
                  }`}
                >
                  {sessionTitle(s)}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                  <span>{relativeTime(s.updatedAt)}</span>
                  {s.doc && <span>· v{s.doc.version}</span>}
                  {s.messages.length > 0 && <span>· 메시지 {s.messages.length}</span>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                title="삭제"
                aria-label={`${sessionTitle(s)} 삭제`}
                className="absolute right-2 top-2.5 hidden h-6 w-6 items-center justify-center rounded-md
                  text-faint transition-colors hover:bg-panel3 hover:text-danger group-hover:flex
                  focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
