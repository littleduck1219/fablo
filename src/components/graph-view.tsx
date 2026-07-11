"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitFork } from "lucide-react";
import { useMemo } from "react";
import { KIND_META, layoutGraph, type EntityNode } from "@/lib/graph";
import type { GraphSpec } from "@/lib/types";

function EntityNodeView({ data, selected }: NodeProps<EntityNode>) {
  const meta = KIND_META[data.kind];
  return (
    <div
      className={`min-w-[132px] rounded-lg border bg-panel2 px-3 py-2.5 shadow-md transition-colors ${
        selected ? "border-accent/70" : "border-linestrong"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-0 !bg-faint"
      />
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-[3px]"
          style={{ background: meta.color }}
        />
        <span className="text-[12px] font-medium text-ink">{data.label}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 pl-4">
        <span className="text-[9.5px] uppercase tracking-wide text-faint">
          {meta.label}
        </span>
        {data.ref && (
          <span className="rounded bg-panel3 px-1 py-px font-mono text-[9px] text-muted">
            {data.ref}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-0 !bg-faint"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { entity: EntityNodeView };

export function GraphView({ graph }: { graph: GraphSpec | null }) {
  const layout = useMemo(() => (graph ? layoutGraph(graph) : null), [graph]);

  if (!layout || layout.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center pb-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel2">
          <GitFork size={20} className="text-faint" />
        </div>
        <p className="mt-3 text-[13px] font-medium text-muted">아직 연결도가 없어요</p>
        <p className="mt-1 text-[12px] text-faint">
          PRD가 생성되면 기능 간 관계가 여기에 그려집니다.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* key로 그래프 변경 시 리마운트 → fitView 재실행 */}
      <ReactFlow
        key={`${layout.nodes.length}-${layout.edges.length}-${layout.nodes[0]?.id ?? ""}`}
        defaultNodes={layout.nodes}
        defaultEdges={layout.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.2}
          color="var(--line)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-lg border border-line bg-panel/90 px-3 py-2 backdrop-blur">
        {Object.entries(KIND_META).map(([kind, meta]) => (
          <span key={kind} className="flex items-center gap-1.5 text-[10.5px] text-muted">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: meta.color }} />
            {meta.label}
          </span>
        ))}
      </div>
    </div>
  );
}
