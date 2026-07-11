"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PrdDoc, Priority, Requirement, ReqStatus } from "@/lib/types";

const PRIORITY_STYLE: Record<Priority, string> = {
  P0: "bg-danger/12 text-danger",
  P1: "bg-accent/12 text-accent",
  P2: "bg-panel3 text-muted",
};

const STATUS_STYLE: Record<ReqStatus, string> = {
  확정: "bg-ok/12 text-ok",
  검토중: "bg-info/12 text-info",
  초안: "bg-panel3 text-muted",
};

const PRIORITY_CYCLE: Priority[] = ["P0", "P1", "P2"];
const STATUS_CYCLE: ReqStatus[] = ["확정", "검토중", "초안"];

/* ---------- 인라인 편집 프리미티브 ---------- */

type EditableProps = {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  className?: string;
  as?: "span" | "p";
};

/** 클릭하면 입력으로 바뀌는 텍스트. Enter(단일행)/blur 커밋, Esc 취소. */
function Editable({ value, onCommit, multiline = false, className = "", as = "span" }: EditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const el = inputRef.current;
      el.setSelectionRange(el.value.length, el.value.length);
      if (el instanceof HTMLTextAreaElement) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onCommit(v);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    const Tag = as;
    return (
      <Tag
        role="button"
        tabIndex={0}
        title="클릭해서 편집"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setDraft(value);
            setEditing(true);
          }
        }}
        className={`-mx-1 cursor-text rounded px-1 transition-colors hover:bg-panel3/70 hover:ring-1 hover:ring-line
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${className}`}
      >
        {value}
      </Tag>
    );
  }

  const shared = {
    value: draft,
    onBlur: commit,
    spellCheck: false,
    className: `-mx-1 w-full rounded border border-accent/50 bg-panel3 px-1 py-0 outline-none ${className}`,
  };

  return multiline ? (
    <textarea
      {...shared}
      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      rows={1}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
      }}
      className={`${shared.className} resize-none leading-[inherit]`}
    />
  ) : (
    <input
      {...shared}
      ref={inputRef as React.RefObject<HTMLInputElement>}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
        if (e.key === "Enter" && !e.nativeEvent.isComposing) commit();
      }}
    />
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <h2 className="mb-3 mt-10 flex items-baseline gap-2.5 text-[15px] font-semibold first:mt-0">
      <span className="font-mono text-[11px] text-accent">{index}</span>
      {title}
    </h2>
  );
}

/* ---------- 본문 ---------- */

type PrdViewProps = {
  doc: PrdDoc;
  /** 함수형 업데이트 — 연속 편집이 서로를 덮어쓰지 않도록 최신 문서 기준으로 적용 */
  onChange: (updater: (doc: PrdDoc) => PrdDoc) => void;
};

export function PrdView({ doc, onChange }: PrdViewProps) {
  const patch = (fn: (d: PrdDoc) => Partial<PrdDoc>) => onChange((d) => ({ ...d, ...fn(d) }));

  const patchReq = (i: number, p: Partial<Requirement>) =>
    patch((d) => ({ requirements: d.requirements.map((r, k) => (k === i ? { ...r, ...p } : r)) }));

  const removeReq = (i: number) =>
    patch((d) => ({ requirements: d.requirements.filter((_, k) => k !== i) }));

  const addReq = () =>
    patch((d) => {
      const maxNum = d.requirements.reduce((n, r) => {
        const m = /REQ-(\d+)/.exec(r.id);
        return m ? Math.max(n, Number(m[1])) : n;
      }, 0);
      return {
        requirements: [
          ...d.requirements,
          {
            id: `REQ-${String(maxNum + 1).padStart(3, "0")}`,
            title: "새 요구사항",
            desc: "설명을 입력하세요.",
            priority: "P2" as const,
            status: "초안" as const,
          },
        ],
      };
    });

  const cyclePriority = (i: number) =>
    patch((d) => ({
      requirements: d.requirements.map((r, k) =>
        k === i
          ? { ...r, priority: PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(r.priority) + 1) % PRIORITY_CYCLE.length] }
          : r,
      ),
    }));
  const cycleStatus = (i: number) =>
    patch((d) => ({
      requirements: d.requirements.map((r, k) =>
        k === i
          ? { ...r, status: STATUS_CYCLE[(STATUS_CYCLE.indexOf(r.status) + 1) % STATUS_CYCLE.length] }
          : r,
      ),
    }));

  return (
    <article className="mx-auto w-full max-w-[720px] px-8 py-8">
      {/* Doc header */}
      <header className="mb-8 border-b border-line pb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-md bg-accent/12 px-2 py-0.5 font-mono text-[10.5px] font-medium text-accent">
            PRD
          </span>
          <span className="font-mono text-[11px] text-faint">v{doc.version}</span>
          <span className="text-[11px] text-faint/70">· 텍스트를 클릭하면 바로 편집됩니다</span>
        </div>
        <h1 className="text-[22px] font-bold leading-snug tracking-tight">
          <Editable value={doc.title} onCommit={(v) => patch(() => ({ title: v }))} multiline />
        </h1>
      </header>

      <SectionTitle index="01" title="개요" />
      <p className="text-[13.5px] leading-[1.75] text-ink/85">
        <Editable value={doc.overview} onCommit={(v) => patch(() => ({ overview: v }))} multiline />
      </p>

      <SectionTitle index="02" title="문제 정의" />
      <p className="text-[13.5px] leading-[1.75] text-ink/85">
        <Editable value={doc.problem} onCommit={(v) => patch(() => ({ problem: v }))} multiline />
      </p>

      {doc.solution && (
        <>
          <SectionTitle index="03" title="해결 전략" />
          <p className="text-[13.5px] leading-[1.75] text-ink/85">
            <Editable value={doc.solution} onCommit={(v) => patch(() => ({ solution: v }))} multiline />
          </p>
        </>
      )}

      {!!doc.differentiators?.length && (
        <>
          <SectionTitle index="04" title="차별점" />
          <ul className="flex flex-col gap-2">
            {doc.differentiators.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink/85">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                <Editable value={item} multiline onCommit={(v) => patch((d) => ({ differentiators: d.differentiators?.map((x, k) => k === i ? v : x) }))} />
              </li>
            ))}
          </ul>
        </>
      )}

      {!!doc.scenarios?.length && (
        <>
          <SectionTitle index="05" title="핵심 사용자 시나리오" />
          <div className="flex flex-col gap-3">
            {doc.scenarios.map((scenario, i) => (
              <div key={i} className="rounded-lg border border-line bg-panel2 p-4">
                <div className="text-[13px] font-semibold"><Editable value={scenario.name} onCommit={(v) => patch((d) => ({ scenarios: d.scenarios?.map((x, k) => k === i ? { ...x, name: v } : x) }))} /></div>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[12px] leading-relaxed text-muted">
                  {scenario.steps.map((step, j) => <li key={j}><Editable value={step} multiline onCommit={(v) => patch((d) => ({ scenarios: d.scenarios?.map((x, k) => k === i ? { ...x, steps: x.steps.map((s, n) => n === j ? v : s) } : x) }))} /></li>)}
                </ol>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle index="06" title="목표 및 성공 지표" />
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-panel2 text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-4 py-2.5 font-medium">지표</th>
              <th className="px-4 py-2.5 font-medium">목표</th>
            </tr>
          </thead>
          <tbody>
            {doc.goals.map((g, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 text-ink/85">
                  <Editable
                    value={g.metric}
                    onCommit={(v) =>
                      patch((d) => ({ goals: d.goals.map((x, k) => (k === i ? { ...x, metric: v } : x)) }))
                    }
                  />
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-accentstrong">
                  <Editable
                    value={g.target}
                    onCommit={(v) =>
                      patch((d) => ({ goals: d.goals.map((x, k) => (k === i ? { ...x, target: v } : x)) }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle index="07" title="사용자 페르소나" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {doc.personas.map((p, i) => (
          <div key={i} className="rounded-lg border border-line bg-panel2 p-4">
            <div className="text-[13px] font-semibold">
              <Editable
                value={p.name}
                onCommit={(v) =>
                  patch((d) => ({ personas: d.personas.map((x, k) => (k === i ? { ...x, name: v } : x)) }))
                }
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              <Editable
                value={p.desc}
                multiline
                onCommit={(v) =>
                  patch((d) => ({ personas: d.personas.map((x, k) => (k === i ? { ...x, desc: v } : x)) }))
                }
              />
            </p>
          </div>
        ))}
      </div>

      {(!!doc.roles?.length || !!doc.devices?.length) && (
        <>
          <SectionTitle index="08" title="사용 환경" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel2 p-4"><div className="mb-2 text-[11px] font-medium text-faint">사용자 역할</div><div className="flex flex-wrap gap-1.5">{doc.roles?.map((role) => <span key={role} className="rounded bg-panel3 px-2 py-1 text-[11px] text-ink/85">{role}</span>)}</div></div>
            <div className="rounded-lg border border-line bg-panel2 p-4"><div className="mb-2 text-[11px] font-medium text-faint">대상 기기</div><div className="flex flex-wrap gap-1.5">{doc.devices?.map((device) => <span key={device} className="rounded bg-panel3 px-2 py-1 text-[11px] text-ink/85">{device}</span>)}</div></div>
          </div>
        </>
      )}

      <SectionTitle index="09" title="핵심 기능 요구사항" />
      <div className="flex flex-col gap-2">
        {doc.requirements.map((r, i) => (
          <div
            key={r.id}
            className="group rounded-lg border border-line bg-panel2 px-4 py-3 transition-colors hover:border-linestrong"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] text-faint">{r.id}</span>
              <span className="min-w-0 text-[13px] font-medium">
                <Editable value={r.title} onCommit={(v) => patchReq(i, { title: v })} />
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cyclePriority(i)}
                  title="클릭해서 우선순위 변경"
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-transform
                    hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                    ${PRIORITY_STYLE[r.priority]}`}
                >
                  {r.priority}
                </button>
                <button
                  type="button"
                  onClick={() => cycleStatus(i)}
                  title="클릭해서 상태 변경"
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-transform
                    hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                    ${STATUS_STYLE[r.status]}`}
                >
                  {r.status}
                </button>
                <button
                  type="button"
                  onClick={() => removeReq(i)}
                  title="요구사항 삭제"
                  aria-label={`${r.id} 삭제`}
                  className="flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition-opacity
                    hover:bg-danger/15 hover:text-danger group-hover:opacity-100
                    focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                >
                  <X size={12} />
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              <Editable value={r.desc} multiline onCommit={(v) => patchReq(i, { desc: v })} />
            </p>
          </div>
        ))}
        <button
          type="button"
          onClick={addReq}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-4 py-2.5
            text-[12px] text-faint transition-colors hover:border-accent/50 hover:text-accent
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <Plus size={13} /> 요구사항 추가
        </button>
      </div>

      <SectionTitle index="10" title="비기능 요구사항" />
      <ul className="flex flex-col gap-2">
        {doc.nonFunctional.map((n, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink/85">
            <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 flex-1">
              <Editable
                value={n}
                multiline
                onCommit={(v) =>
                  patch((d) => ({ nonFunctional: d.nonFunctional.map((x, k) => (k === i ? v : x)) }))
                }
              />
            </span>
          </li>
        ))}
      </ul>

      {!!doc.risks?.length && (
        <>
          <SectionTitle index="11" title="리스크 및 대응" />
          <div className="flex flex-col gap-2">
            {doc.risks.map((item, i) => (
              <div key={i} className="rounded-lg border border-line bg-panel2 px-4 py-3">
                <div className="text-[12.5px] font-medium text-ink/90"><Editable value={item.risk} multiline onCommit={(v) => patch((d) => ({ risks: d.risks?.map((x, k) => k === i ? { ...x, risk: v } : x) }))} /></div>
                <div className="mt-1 text-[12px] leading-relaxed text-muted"><span className="mr-1.5 text-accent">대응</span><Editable value={item.mitigation} multiline onCommit={(v) => patch((d) => ({ risks: d.risks?.map((x, k) => k === i ? { ...x, mitigation: v } : x) }))} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle index="12" title="마일스톤" />
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-panel2 text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-4 py-2.5 font-medium">단계</th>
              <th className="px-4 py-2.5 font-medium">범위</th>
              <th className="px-4 py-2.5 font-medium">기간</th>
            </tr>
          </thead>
          <tbody>
            {doc.milestones.map((m, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink/90">
                  <Editable
                    value={m.phase}
                    onCommit={(v) =>
                      patch((d) => ({ milestones: d.milestones.map((x, k) => (k === i ? { ...x, phase: v } : x)) }))
                    }
                  />
                </td>
                <td className="px-4 py-2.5 text-muted">
                  <Editable
                    value={m.scope}
                    onCommit={(v) =>
                      patch((d) => ({ milestones: d.milestones.map((x, k) => (k === i ? { ...x, scope: v } : x)) }))
                    }
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-muted">
                  <Editable
                    value={m.eta}
                    onCommit={(v) =>
                      patch((d) => ({ milestones: d.milestones.map((x, k) => (k === i ? { ...x, eta: v } : x)) }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-16" />
    </article>
  );
}
