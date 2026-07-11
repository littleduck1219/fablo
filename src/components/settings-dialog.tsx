"use client";

import { Download, Settings, Trash2, Upload, X } from "lucide-react";
import { useRef } from "react";

const STORAGE_KEY = "fablo:v1";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** 로컬 데이터(세션·문서·API 키 전부)의 백업 / 복원 / 초기화 */
export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const backup = () => {
    const raw = localStorage.getItem(STORAGE_KEY) ?? "{}";
    const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fablo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const restore = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || (!parsed.sessions && !parsed.providers)) {
          window.alert("Fablo 백업 파일이 아닙니다.");
          return;
        }
        if (!window.confirm("현재 데이터를 백업 파일 내용으로 덮어쓸까요?")) return;
        localStorage.setItem(STORAGE_KEY, raw);
        window.location.reload(); // ponytail: 상태 재하이드레이션 대신 새로고침 — 전 상태가 localStorage 기반이라 이것이 곧 복원
      } catch {
        window.alert("파일을 읽지 못했습니다. JSON 백업 파일인지 확인해 주세요.");
      }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (!window.confirm("모든 데이터(문서·대화·API 키)를 삭제할까요? 되돌릴 수 없습니다.")) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const row =
    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-panel3 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

  return (
    <div
      className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="설정"
    >
      <div className="dialog-in flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-linestrong bg-panel2 shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Settings size={15} className="text-accent" />
            설정
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

        <div className="p-2">
          <p className="px-3 pb-1 pt-2 text-[12px] leading-relaxed text-faint">
            모든 데이터는 이 브라우저의 localStorage에만 저장됩니다.
          </p>

          <button type="button" onClick={backup} className={row}>
            <Download size={16} className="shrink-0 text-muted" />
            <span>
              <span className="block text-[13px] text-ink">데이터 백업</span>
              <span className="block text-[11px] text-faint">
                문서·대화·연결 정보를 JSON 파일로 저장 (API 키 포함 — 안전한 곳에 보관)
              </span>
            </span>
          </button>

          <button type="button" onClick={() => fileRef.current?.click()} className={row}>
            <Upload size={16} className="shrink-0 text-muted" />
            <span>
              <span className="block text-[13px] text-ink">백업 복원</span>
              <span className="block text-[11px] text-faint">백업 JSON 파일로 현재 데이터를 덮어쓰기</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = "";
            }}
          />

          <button type="button" onClick={clearAll} className={row}>
            <Trash2 size={16} className="shrink-0 text-danger" />
            <span>
              <span className="block text-[13px] text-danger">전체 데이터 삭제</span>
              <span className="block text-[11px] text-faint">문서·대화·API 키를 모두 지우고 초기 상태로</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
