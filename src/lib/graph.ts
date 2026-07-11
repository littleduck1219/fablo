import type { Edge, Node } from "@xyflow/react";
import type { GraphSpec, NodeKind } from "./types";

export type EntityNodeData = {
  label: string;
  kind: NodeKind;
  ref?: string; // 연결된 요구사항 ID
};

export type EntityNode = Node<EntityNodeData, "entity">;

export const KIND_META: Record<NodeKind, { label: string; color: string }> = {
  actor: { label: "액터", color: "var(--accent)" },
  screen: { label: "화면", color: "var(--info)" },
  feature: { label: "기능", color: "var(--ok)" },
  service: { label: "서비스", color: "#a78bfa" },
  data: { label: "데이터", color: "var(--data)" },
};

const KINDS = new Set<NodeKind>(["actor", "screen", "feature", "service", "data"]);

const COL_W = 235;
const ROW_H = 115;

/**
 * GraphSpec → React Flow 노드/엣지.
 * position이 없는 노드는 루트(진입 차수 0)로부터의 BFS 깊이로 열을 정하고,
 * 같은 열 안에서 행을 배분하는 레이어드 자동 레이아웃을 적용한다.
 */
export function layoutGraph(spec: GraphSpec): { nodes: EntityNode[]; edges: Edge[] } {
  const depth = computeDepths(spec);

  // 열별 행 인덱스 배분
  const rowInCol = new Map<string, number>();
  const colCount = new Map<number, number>();
  for (const n of spec.nodes) {
    const d = depth.get(n.id) ?? 0;
    rowInCol.set(n.id, colCount.get(d) ?? 0);
    colCount.set(d, (colCount.get(d) ?? 0) + 1);
  }

  const nodes: EntityNode[] = spec.nodes.map((n) => ({
    id: n.id,
    type: "entity",
    position:
      n.position ??
      (() => {
        const d = depth.get(n.id) ?? 0;
        const row = rowInCol.get(n.id) ?? 0;
        const rows = colCount.get(d) ?? 1;
        return {
          x: d * COL_W,
          // 열 안에서 세로 중앙 정렬 + 지그재그 오프셋으로 엣지 겹침 완화
          y: (row - (rows - 1) / 2) * ROW_H + (d % 2) * 24,
        };
      })(),
    data: {
      label: n.label,
      kind: KINDS.has(n.kind) ? n.kind : "feature",
      ref: n.ref,
    },
  }));

  const edges: Edge[] = spec.edges.map((e, i) => ({
    id: `${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated ?? false,
    style: { stroke: "var(--line-strong)", strokeWidth: 1.5 },
    labelStyle: { fill: "var(--muted)", fontSize: 10 },
    labelBgStyle: { fill: "var(--bg)", fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}

/** 진입 차수 0인 노드들에서 BFS — 사이클 안전. 루트가 없으면 첫 노드에서 시작. */
function computeDepths(spec: GraphSpec): Map<string, number> {
  const depth = new Map<string, number>();
  const out = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const n of spec.nodes) {
    out.set(n.id, []);
    inDeg.set(n.id, 0);
  }
  for (const e of spec.edges) {
    out.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = spec.nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (queue.length === 0 && spec.nodes.length > 0) queue.push(spec.nodes[0].id);
  for (const id of queue) depth.set(id, 0);

  while (queue.length > 0) {
    const cur = queue.shift() as string;
    const d = depth.get(cur) ?? 0;
    for (const next of out.get(cur) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }
  // 어디에도 연결되지 않아 방문 못 한 노드
  for (const n of spec.nodes) if (!depth.has(n.id)) depth.set(n.id, 0);
  return depth;
}
