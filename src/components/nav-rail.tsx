"use client";

import {
  Cable,
  FileText,
  History,
  LayoutTemplate,
  MessagesSquare,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";

export type SidePanel = "archive" | "history" | "templates" | null;

type NavRailProps = {
  connectedCount: number;
  panel: SidePanel;
  onTogglePanel: (p: Exclude<SidePanel, null>) => void;
  onOpenModelDialog: () => void;
  onOpenSettings: () => void;
};

function RailButton({
  icon,
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
        ${
          active
            ? "bg-panel3 text-ink"
            : disabled
              ? "text-faint/60 cursor-not-allowed"
              : "text-muted hover:bg-panel2 hover:text-ink"
        }`}
    >
      {icon}
      {children}
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute left-full z-30 ml-2 whitespace-nowrap rounded-md border border-line
          bg-panel3 px-2 py-1 text-[11px] text-ink opacity-0 shadow-lg transition-opacity delay-100
          group-hover:opacity-100"
      >
        {label}
        {disabled && <span className="ml-1 text-faint">· 준비 중</span>}
      </span>
    </button>
  );
}

export function NavRail({
  connectedCount,
  panel,
  onTogglePanel,
  onOpenModelDialog,
  onOpenSettings,
}: NavRailProps) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3">
      {/* Logo mark */}
      <div
        className="mb-3 flex h-9 w-9 select-none items-center justify-center rounded-[10px] bg-accent/15
          font-mono text-[15px] font-bold text-accent"
        aria-label="Fablo"
      >
        F
      </div>

      <RailButton icon={<MessagesSquare size={19} />} label="워크스페이스" active />
      <RailButton
        icon={<FileText size={19} />}
        label="문서 보관함"
        active={panel === "archive"}
        onClick={() => onTogglePanel("archive")}
      />
      <RailButton
        icon={<History size={19} />}
        label="히스토리"
        active={panel === "history"}
        onClick={() => onTogglePanel("history")}
      />
      <RailButton
        icon={<LayoutTemplate size={19} />}
        label="PRD 템플릿"
        active={panel === "templates"}
        onClick={() => onTogglePanel("templates")}
      />

      <div className="mt-auto flex flex-col items-center gap-1">
        <RailButton
          icon={<Cable size={19} />}
          label={
            connectedCount > 0
              ? `모델 연결 · ${connectedCount}개 연결됨`
              : "모델 연결 · 연결 안 됨"
          }
          onClick={onOpenModelDialog}
        >
          {/* Connection status dot */}
          <span
            className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-panel ${
              connectedCount > 0 ? "bg-ok" : "bg-faint"
            }`}
          />
        </RailButton>
        <RailButton icon={<Settings size={19} />} label="설정" onClick={onOpenSettings} />
      </div>
    </nav>
  );
}
