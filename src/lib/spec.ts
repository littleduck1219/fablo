import type { SpecItem, SpecPriority, SpecStatus } from "./types";

export const PRIORITY_META: Record<SpecPriority, { color: string; emoji: string }> = {
  높음: { color: "var(--danger)", emoji: "🔴" },
  중간: { color: "var(--accent)", emoji: "🟡" },
  낮음: { color: "var(--ok)", emoji: "🟢" },
};

export const PRIORITY_CYCLE: Record<SpecPriority, SpecPriority> = {
  높음: "중간",
  중간: "낮음",
  낮음: "높음",
};

export const STATUS_CYCLE: Record<SpecStatus, SpecStatus> = {
  작성중: "검토중",
  검토중: "확정",
  확정: "작성중",
};

export function findSpecItem(features: SpecItem[], id: string): SpecItem | null {
  for (const f of features) {
    if (f.id === id) return f;
    const hit = f.children ? findSpecItem(f.children, id) : null;
    if (hit) return hit;
  }
  return null;
}

/** id에 해당하는 항목에 patch를 적용한 새 트리를 돌려준다. */
export function updateSpecItem(
  features: SpecItem[],
  id: string,
  patch: Partial<SpecItem>,
): SpecItem[] {
  return features.map((f) => {
    if (f.id === id) return { ...f, ...patch };
    if (f.children) {
      const children = updateSpecItem(f.children, id, patch);
      if (children !== f.children) return { ...f, children };
    }
    return f;
  });
}

export type SpecFlowNode = {
  id: string;
  x: number;
  y: number;
  depth: number; // 0 = 제품 루트, 1 = 주요 기능, 2 = 기능, 3 = 상세 기능
  item: SpecItem | null; // 루트는 null (제품명 노드)
};

export type SpecFlowEdge = { source: string; target: string };

const COL_W = 300;
const ROW_H = 72;
const ROOT_ID = "__root__";

/**
 * 기능명세서 계층 → 트리 레이아웃 좌표.
 * 리프가 행을 하나씩 차지하고 부모는 자식들의 세로 중앙에 온다 (마인드맵 형태).
 */
export function layoutSpecTree(features: SpecItem[]): {
  nodes: SpecFlowNode[];
  edges: SpecFlowEdge[];
} {
  const nodes: SpecFlowNode[] = [];
  const edges: SpecFlowEdge[] = [];
  let row = 0;

  const place = (item: SpecItem, depth: number, parentId: string): number => {
    let y: number;
    if (item.children?.length) {
      const ys = item.children.map((c) => place(c, depth + 1, item.id));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    } else {
      y = row++ * ROW_H;
    }
    nodes.push({ id: item.id, x: depth * COL_W, y, depth, item });
    edges.push({ source: parentId, target: item.id });
    return y;
  };

  const topYs = features.map((f) => place(f, 1, ROOT_ID));
  const rootY = topYs.length ? (topYs[0] + topYs[topYs.length - 1]) / 2 : 0;
  nodes.push({ id: ROOT_ID, x: 0, y: rootY, depth: 0, item: null });

  return { nodes, edges };
}

export { ROOT_ID as SPEC_ROOT_ID };
