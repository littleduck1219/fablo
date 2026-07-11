"use client";

import { PRD_TEMPLATES, type PrdTemplate } from "@/lib/templates";

type TemplatePanelProps = {
  onApply: (t: PrdTemplate) => void;
};

export function TemplatePanel({ onApply }: TemplatePanelProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center border-b border-line px-4 py-3">
        <h2 className="text-[13px] font-semibold text-ink">PRD 템플릿</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-3 py-2 text-[12px] leading-relaxed text-faint">
          템플릿으로 새 문서를 만들고, 클릭 편집이나 대화로 채워 넣으세요.
        </p>
        {PRD_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply(t)}
            className="mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-panel2
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <div className="text-[13px] font-medium text-ink">{t.name}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-faint">{t.desc}</div>
            <div className="mt-0.5 text-[11px] text-faint">요구사항 {t.doc.requirements.length}개 뼈대</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
