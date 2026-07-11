"use client";

import { RotateCcw } from "lucide-react";
import { relativeTime } from "@/components/archive-panel";
import type { DocSnapshot } from "@/lib/types";

type HistoryPanelProps = {
  history: DocSnapshot[];
  currentVersion: number | null;
  onRestore: (snap: DocSnapshot) => void;
};

export function HistoryPanel({ history, currentVersion, onRestore }: HistoryPanelProps) {
  const items = [...history].reverse(); // 최신 스냅샷부터

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-ink">버전 히스토리</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {currentVersion !== null && (
          <div className="mb-1 rounded-lg bg-panel3 px-3 py-2.5">
            <div className="text-[13px] font-medium text-ink">v{currentVersion} · 현재</div>
          </div>
        )}
        {items.length === 0 && (
          <p className="px-3 py-2 text-[12px] leading-relaxed text-faint">
            문서가 갱신될 때마다 이전 버전이 여기에 쌓입니다.
          </p>
        )}
        {items.map((snap) => (
          <div key={`${snap.version}-${snap.savedAt}`} className="group relative mb-1 rounded-lg hover:bg-panel2">
            <div className="rounded-lg px-3 py-2.5">
              <div className="truncate pr-6 text-[13px] text-ink/90">
                v{snap.version} · {snap.doc.title}
              </div>
              <div className="mt-0.5 text-[11px] text-faint">
                {relativeTime(snap.savedAt)} · 요구사항 {snap.doc.requirements.length}개
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestore(snap)}
              title={`v${snap.version}으로 복원`}
              aria-label={`v${snap.version}으로 복원`}
              className="absolute right-2 top-2.5 hidden h-6 w-6 items-center justify-center rounded-md
                text-faint transition-colors hover:bg-panel3 hover:text-ink group-hover:flex
                focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
