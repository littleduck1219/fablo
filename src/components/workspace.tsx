"use client";

import { Copy, Download, FileText, GitFork, Loader2 } from "lucide-react";
import { useState } from "react";
import { downloadSpecMarkdown, prdToMarkdown, specToMarkdown } from "@/lib/markdown";
import type { GraphSpec, PrdDoc, SpecDoc } from "@/lib/types";
import { PrdView } from "./prd-view";
import { SpecView } from "./spec-view";

export type WorkspaceTab = "prd" | "graph";

type WorkspaceProps = {
  doc: PrdDoc | null;
  graph: GraphSpec | null;
  spec: SpecDoc | null;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  /** 문서가 갱신되어 확인이 필요할 때 PRD 탭에 펄스 표시 */
  docPulse: boolean;
  generating: boolean;
  /** 인라인 편집으로 문서가 수정될 때 (함수형 업데이트) */
  onDocChange: (updater: (doc: PrdDoc) => PrdDoc) => void;
  onSpecChange: (updater: (spec: SpecDoc) => SpecDoc) => void;
  onCreateSpec: () => void;
};

function EmptyWorkspace({ generating }: { generating: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center pb-16">
      {generating ? (
        <>
          <Loader2 size={22} className="animate-spin text-accent" />
          <p className="mt-3 text-[13px] text-muted">PRD를 생성하고 있어요…</p>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel2">
            <FileText size={20} className="text-faint" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-muted">
            아직 생성된 문서가 없어요
          </p>
          <p className="mt-1 text-[12px] text-faint">
            왼쪽 대화에서 제품 아이디어를 설명하면 여기에 PRD가 나타납니다.
          </p>
        </>
      )}
    </div>
  );
}

export function Workspace({
  doc, graph, spec, tab, onTabChange, docPulse, generating, onDocChange, onSpecChange, onCreateSpec,
}: WorkspaceProps) {
  const [copied, setCopied] = useState(false);

  // PRD 탭 = PRD md 복사, 명세 탭 = 기능명세서 md 복사/내보내기
  const copyDoc = () => {
    if (!doc) return;
    const md = tab === "graph" && spec ? specToMarkdown(doc, spec) : prdToMarkdown(doc, graph);
    navigator.clipboard?.writeText(md).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        {/* Segmented tab control */}
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
          <button
            type="button"
            onClick={() => onTabChange("prd")}
            className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
              ${tab === "prd" ? "bg-panel3 text-ink" : "text-muted hover:text-ink"}`}
          >
            <FileText size={13} />
            PRD 문서
            {docPulse && tab !== "prd" && (
              <span className="pulse-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onTabChange("graph")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
              ${tab === "graph" ? "bg-panel3 text-ink" : "text-muted hover:text-ink"}`}
          >
            <GitFork size={13} />
            기능명세서
          </button>
        </div>

        {doc && (
          <div className="flex items-center gap-2">
            <span className="hidden font-mono text-[11px] text-faint md:block">
              v{doc.version}
            </span>
            <button
              type="button"
              onClick={copyDoc}
              className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[11.5px] text-muted
                transition-colors hover:border-linestrong hover:text-ink
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Copy size={12} />
              {copied ? "복사됨" : "복사"}
            </button>
            {tab === "graph" && spec && (
              <button
                type="button"
                onClick={() => downloadSpecMarkdown(doc, spec)}
                title="기능명세서를 AI용 Markdown으로 다운로드"
                className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[11.5px] text-muted
                  transition-colors hover:border-linestrong hover:text-ink
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <Download size={12} />
                내보내기
              </button>
            )}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {!doc ? (
          <EmptyWorkspace generating={generating} />
        ) : tab === "prd" ? (
          <div className="h-full overflow-y-auto">
            <PrdView doc={doc} onChange={onDocChange} />
          </div>
        ) : (
          <SpecView
            productTitle={doc.title.split("—")[0].trim()}
            spec={spec}
            onSpecChange={onSpecChange}
            onCreate={onCreateSpec}
            creating={generating}
          />
        )}
      </div>
    </section>
  );
}
