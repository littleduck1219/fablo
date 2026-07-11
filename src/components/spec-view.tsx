"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitFork, Loader2, Plus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  PRIORITY_CYCLE,
  PRIORITY_META,
  SPEC_ROOT_ID,
  STATUS_CYCLE,
  findSpecItem,
  layoutSpecTree,
  updateSpecItem,
} from "@/lib/spec";
import type { SpecDoc, SpecItem } from "@/lib/types";

type SpecNodeData = {
  title: string;
  item: SpecItem | null;
  active: boolean;
};

type SpecNode = Node<SpecNodeData, "spec">;

function SpecNodeView({ data }: NodeProps<SpecNode>) {
  const { item, active } = data;
  return (
    <div
      className={`min-w-[150px] max-w-[240px] rounded-lg border bg-panel2 px-3 py-2 shadow-md transition-colors ${
        active ? "border-accent" : "border-linestrong hover:border-accent/50"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-faint" />
      {item ? (
        <>
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: PRIORITY_META[item.priority].color }}
            />
            <span className="rounded bg-panel3 px-1 py-px font-mono text-[9px] text-muted">{item.id}</span>
            <span className="truncate text-[12px] font-medium text-ink">{item.title}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 pl-3.5 text-[9.5px] text-faint">
            <span>{item.status}</span>
            {item.role && <span>· {item.role}</span>}
            {item.device && <span>· {item.device}</span>}
            {item.children?.length ? <span>· 하위 {item.children.length}</span> : null}
          </div>
        </>
      ) : (
        <div className="px-1 py-0.5 text-[13px] font-semibold text-accent">{data.title}</div>
      )}
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-faint" />
    </div>
  );
}

const nodeTypes: NodeTypes = { spec: SpecNodeView };

/** 상세 패널의 한 필드 (제어 입력 — 수정 즉시 spec에 반영) */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-muted">{label}</div>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12.5px] text-ink " +
  "focus:border-accent/60 focus:outline-none";

export function SpecView({
  productTitle,
  spec,
  onSpecChange,
  onCreate,
  creating = false,
}: {
  productTitle: string;
  spec: SpecDoc | null;
  onSpecChange: (updater: (spec: SpecDoc) => SpecDoc) => void;
  onCreate?: () => void;
  creating?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const flow = useMemo(() => {
    if (!spec || spec.features.length === 0) return null;
    const { nodes, edges } = layoutSpecTree(spec.features);
    const rfNodes: SpecNode[] = nodes.map((n) => ({
      id: n.id,
      type: "spec",
      position: { x: n.x, y: n.y },
      draggable: false,
      data: { title: productTitle, item: n.item, active: n.id === selectedId },
    }));
    const rfEdges: Edge[] = edges.map((e) => ({
      id: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      style: { stroke: "var(--line-strong)", strokeWidth: 1.5 },
    }));
    return { nodes: rfNodes, edges: rfEdges };
  }, [spec, productTitle, selectedId]);

  const selected = spec && selectedId ? findSpecItem(spec.features, selectedId) : null;

  const patch = (p: Partial<SpecItem>) => {
    if (!selectedId) return;
    onSpecChange((s) => ({ ...s, features: updateSpecItem(s.features, selectedId, p) }));
  };

  if (!flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center pb-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel2">
          <GitFork size={20} className="text-faint" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-muted">아직 기능명세서가 없어요</p>
        <p className="mt-1 text-[12px] text-faint">
          대화로 문서를 생성하면 요구사항 → 기능 → 상세 기능 연결도가 그려집니다.
        </p>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12.5px] font-medium text-[#1a1204]
              transition-colors hover:bg-accentstrong disabled:cursor-not-allowed disabled:opacity-50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {creating && <Loader2 size={13} className="animate-spin" />}
            {creating ? "기능명세서 작성 중…" : "기능명세서 만들기"}
          </button>
        )}
      </div>
    );
  }

  // 초기 줌: 전체 fit은 큰 트리에서 글자가 안 보일 만큼 축소되므로,
  // 항상 읽히는 줌(0.8)으로 루트를 왼쪽-세로중앙에 앵커하고 나머지는 팬/줌으로 탐색
  const INITIAL_ZOOM = 0.8;
  const initViewport = (rf: { setViewport: (v: { x: number; y: number; zoom: number }) => void }) => {
    const root = flow.nodes.find((n) => n.id === SPEC_ROOT_ID);
    const h = wrapperRef.current?.clientHeight ?? 600;
    const z = INITIAL_ZOOM;
    rf.setViewport({
      x: 24 - (root?.position.x ?? 0) * z,
      y: h / 2 - ((root?.position.y ?? 0) + 20) * z,
      zoom: z,
    });
  };

  return (
    <div className="flex h-full">
      <div ref={wrapperRef} className="relative min-w-0 flex-1">
        <ReactFlow
          key={`${flow.nodes.length}-${flow.nodes[0]?.id ?? ""}`}
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedId(node.id === SPEC_ROOT_ID ? null : node.id)}
          onPaneClick={() => setSelectedId(null)}
          onInit={initViewport}
          minZoom={0.3}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--line)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-line bg-panel/90 px-3 py-2 text-[10.5px] text-muted backdrop-blur">
          노드를 클릭하면 상세 내용을 보고 수정할 수 있어요
        </div>
      </div>

      {selected && (
        <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-mono text-[11px] text-muted">{selected.id}</span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="닫기"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors
                hover:bg-panel2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <X size={13} />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4">
            <Field label="이름">
              <input
                className={inputCls}
                value={selected.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </Field>
            <Field label="설명">
              <textarea
                className={`${inputCls} min-h-[72px] resize-y leading-relaxed`}
                value={selected.desc}
                onChange={(e) => patch({ desc: e.target.value })}
              />
            </Field>

            <Field label="연결 요구사항">
              <input
                className={inputCls}
                value={selected.refs?.join(", ") ?? ""}
                placeholder="REQ-001, REQ-002"
                onChange={(e) => {
                  const refs = e.target.value.split(",").map((v) => v.trim()).filter(Boolean);
                  patch({ refs: refs.length ? refs : undefined });
                }}
              />
            </Field>

            <div className="flex gap-2">
              <Field label="중요도">
                <button
                  type="button"
                  onClick={() => patch({ priority: PRIORITY_CYCLE[selected.priority] })}
                  title="클릭해서 변경"
                  className="flex items-center gap-1.5 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12px]
                    transition-colors hover:border-linestrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PRIORITY_META[selected.priority].color }}
                  />
                  {selected.priority}
                </button>
              </Field>
              <Field label="진행 상태">
                <button
                  type="button"
                  onClick={() => patch({ status: STATUS_CYCLE[selected.status] })}
                  title="클릭해서 변경"
                  className="rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[12px]
                    transition-colors hover:border-linestrong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {selected.status}
                </button>
              </Field>
            </div>

            <div className="flex gap-2">
              <Field label="역할">
                <input
                  className={inputCls}
                  value={selected.role ?? ""}
                  placeholder="user"
                  onChange={(e) => patch({ role: e.target.value || undefined })}
                />
              </Field>
              <Field label="기기">
                <input
                  className={inputCls}
                  value={selected.device ?? ""}
                  placeholder="web"
                  onChange={(e) => patch({ device: e.target.value || undefined })}
                />
              </Field>
            </div>

            <Field label="수용 기준">
              <div className="flex flex-col gap-1.5">
                {(selected.acceptance ?? []).map((a, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <textarea
                      className={`${inputCls} min-h-[34px] flex-1 resize-y`}
                      value={a}
                      onChange={(e) => {
                        const next = [...(selected.acceptance ?? [])];
                        next[i] = e.target.value;
                        patch({ acceptance: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (selected.acceptance ?? []).filter((_, j) => j !== i);
                        patch({ acceptance: next.length ? next : undefined });
                      }}
                      aria-label="수용 기준 삭제"
                      className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint
                        transition-colors hover:bg-panel2 hover:text-danger"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => patch({ acceptance: [...(selected.acceptance ?? []), ""] })}
                  className="flex items-center gap-1 self-start rounded-md border border-dashed border-line px-2 py-1
                    text-[11px] text-muted transition-colors hover:border-linestrong hover:text-ink
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <Plus size={11} /> 추가
                </button>
              </div>
            </Field>

            {selected.children?.length ? (
              <Field label={`하위 항목 (${selected.children.length})`}>
                <div className="flex flex-col gap-1.5">
                  {selected.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setSelectedId(child.id)}
                      className="rounded-md border border-line bg-panel2 px-2.5 py-2 text-left transition-colors
                        hover:border-accent/50 hover:bg-panel3
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: PRIORITY_META[child.priority].color }}
                        />
                        <span className="font-mono text-[10px] text-muted">{child.id}</span>
                        <span className="truncate text-[12px] text-ink">{child.title}</span>
                      </div>
                      {child.desc && (
                        <div className="mt-0.5 line-clamp-2 pl-3 text-[10.5px] leading-snug text-faint">
                          {child.desc}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}

            <p className="text-[10.5px] leading-relaxed text-faint">
              수정 내용은 즉시 저장되고 내보내기 결과에 반영됩니다. 항목 추가·삭제는 대화로 요청하세요.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
