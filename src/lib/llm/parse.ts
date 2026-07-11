import type { GraphSpec, PrdDoc, SpecDoc, SpecItem, SpecPriority, SpecStatus } from "@/lib/types";

export const PRD_MARKER = "<<<PRD_JSON>>>";
export const ASK_MARKER = "<<<ASK_JSON>>>";

/** 숨겨야 할 페이로드 시작 위치와 종류 (마커 또는 마커 없이 시작한 JSON). 없으면 null. */
function hiddenStart(full: string): { idx: number; kind: "prd" | "ask" } | null {
  const cands = [
    { idx: full.indexOf(PRD_MARKER), kind: "prd" as const },
    { idx: full.indexOf(ASK_MARKER), kind: "ask" as const },
    // 마커 없이 JSON부터 출력하는 모델 대응
    { idx: full.search(/```(?:json)?\s*\{\s*"doc"\s*:|\{\s*"doc"\s*:/), kind: "prd" as const },
    { idx: full.search(/\{\s*"questions"\s*:/), kind: "ask" as const },
  ].filter((c) => c.idx !== -1);
  if (cands.length === 0) return null;
  return cands.reduce((a, b) => (b.idx < a.idx ? b : a));
}

/**
 * 스트리밍 중 사용자에게 보여줄 텍스트.
 * 마커 이후(JSON)는 숨기고, 청크 경계에서 마커가 잘려 들어오는 경우도 가린다.
 */
export function visibleText(full: string): string {
  const start = hiddenStart(full);
  if (start) return full.slice(0, start.idx).trimEnd();

  // 꼬리가 마커의 접두어면 그 부분은 아직 렌더링하지 않는다
  for (const marker of [PRD_MARKER, ASK_MARKER]) {
    const max = Math.min(marker.length - 1, full.length);
    for (let k = max; k > 0; k--) {
      if (full.endsWith(marker.slice(0, k))) return full.slice(0, full.length - k);
    }
  }
  return full;
}

/* ---------- 생성 진행 상태 (숨겨진 JSON 스트림에서 현재 작성 중인 섹션 추적) ---------- */

const DOC_SECTIONS: [key: string, label: string][] = [
  ['"title"', "제목"],
  ['"overview"', "개요"],
  ['"problem"', "문제 정의"],
  ['"solution"', "해결 전략"],
  ['"differentiators"', "차별점"],
  ['"scenarios"', "핵심 시나리오"],
  ['"risks"', "리스크·대응"],
  ['"roles"', "사용자 역할·기기"],
  ['"goals"', "목표·성공 지표"],
  ['"personas"', "사용자 페르소나"],
  ['"requirements"', "핵심 기능 요구사항"],
  ['"nonFunctional"', "비기능 요구사항"],
  ['"milestones"', "마일스톤"],
];

export type GenProgress = { done: string[]; current: string };

/**
 * 스트리밍 누적 텍스트에서 문서·선택지 생성 진행 상태를 뽑는다. 페이로드가 아직 없으면 null.
 * 스키마 순서가 아니라 실제 스트림 위치 기준: 지금 doc과 spec 중 어느 최상위 객체 안을
 * 쓰고 있는지 먼저 정하고, doc 안에서는 마지막으로 등장한 섹션 키를 현재로 본다.
 * (spec 항목의 중첩 "title" 등이 doc 섹션으로 오인되는 것을 docPos 이후 탐색으로 차단)
 */
export function generationProgress(full: string): GenProgress | null {
  const start = hiddenStart(full);
  if (!start) return null;
  if (start.kind === "ask") return { done: [], current: "선택지" };
  const json = full.slice(start.idx);
  const docPos = json.lastIndexOf('"doc"');
  const specPos = json.lastIndexOf('"spec"');

  if (specPos > docPos) {
    // 기능명세서 작성 중 — 그 전에 쓴 doc 섹션들은 완료 목록으로
    const done =
      docPos === -1
        ? []
        : DOC_SECTIONS.filter(([key]) => {
            const p = json.indexOf(key, docPos);
            return p !== -1 && p < specPos;
          }).map(([, label]) => label);
    return { done, current: "기능명세서" };
  }

  if (docPos === -1) return { done: [], current: "문서 뼈대" };

  // spec을 doc보다 먼저 쓴 모델 대응
  const done = specPos !== -1 ? ["기능명세서"] : [];
  const found = DOC_SECTIONS.map(([key, label]) => ({ label, pos: json.indexOf(key, docPos) }))
    .filter((f) => f.pos !== -1);
  if (found.length === 0) return { done, current: "문서 뼈대" };
  const current = found.reduce((a, b) => (b.pos > a.pos ? b : a));
  return {
    done: [...done, ...found.filter((f) => f !== current).map((f) => f.label)],
    current: current.label,
  };
}

export type PrdPayload = {
  doc: Omit<PrdDoc, "version">;
  graph?: GraphSpec;
  spec?: SpecDoc;
};

export type AskQuestion = { q: string; options: string[]; multi?: boolean };

/** 인터뷰 질문 턴의 선택지 페이로드를 추출한다. 없거나 손상되면 null. */
export function extractQuestions(full: string): AskQuestion[] | null {
  const idx = full.indexOf(ASK_MARKER);
  const from = idx !== -1 ? idx + ASK_MARKER.length : 0;
  const keyAt = full.slice(from).search(/\{\s*"questions"\s*:/);
  if (keyAt === -1) return null;
  const raw = extractBalancedObject(full, from + keyAt);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as { questions?: unknown };
    if (!Array.isArray(obj.questions)) return null;
    const qs = obj.questions
      .filter(
        (x): x is AskQuestion =>
          !!x &&
          typeof (x as AskQuestion).q === "string" &&
          Array.isArray((x as AskQuestion).options) &&
          (x as AskQuestion).options.every((o) => typeof o === "string"),
      )
      .map((x) => ({ q: x.q, options: x.options, multi: x.multi === true }));
    return qs.length > 0 ? qs : null;
  } catch {
    return null;
  }
}

/**
 * 완료된 전체 응답에서 PRD JSON 페이로드를 추출한다.
 * 1순위: 마커 이후 JSON. 폴백: 마커를 생략한 모델을 위해 응답 어디든 {"doc": …} 형태의
 * 균형 잡힌 JSON 객체를 탐지해 복구한다. 없거나 손상되면 null.
 */
export function extractPayload(full: string): PrdPayload | null {
  const idx = full.indexOf(PRD_MARKER);
  const candidates: string[] = [];

  if (idx !== -1) {
    let raw = full.slice(idx + PRD_MARKER.length).trim();
    // 지시를 어기고 코드펜스로 감싼 경우 방어
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    candidates.push(raw);
  }

  // 폴백: "doc" 키를 가진 최상위 JSON 객체 탐색 (마커 누락/변형 대응)
  const docKey = full.search(/\{\s*"doc"\s*:/);
  if (docKey !== -1) {
    const balanced = extractBalancedObject(full, docKey);
    if (balanced) candidates.push(balanced);
  }

  for (const raw of candidates) {
    try {
      const obj = JSON.parse(raw) as PrdPayload;
      if (!isValidDoc(obj?.doc)) continue;
      if (obj.graph && !isValidGraph(obj.graph)) obj.graph = undefined;
      obj.spec = sanitizeSpec(obj.spec) ?? undefined;
      return obj;
    } catch {
      /* 다음 후보 시도 */
    }
  }
  return null;
}

/* ---------- 기능명세서 정제 ---------- */

const PRIORITIES = new Set<SpecPriority>(["높음", "중간", "낮음"]);
const STATUSES = new Set<SpecStatus>(["작성중", "검토중", "확정"]);
// P0/P1/P2로 답하는 모델 대응
const PRIORITY_ALIAS: Record<string, SpecPriority> = { P0: "높음", P1: "중간", P2: "낮음" };

/** 모델이 출력한 spec을 검증·정규화한다. 형식이 어긋난 항목은 버리고, 전부 버려지면 null. */
export function sanitizeSpec(spec: unknown): SpecDoc | null {
  if (!spec || typeof spec !== "object") return null;
  const feats = (spec as { features?: unknown }).features;
  if (!Array.isArray(feats)) return null;
  const clean = feats
    .map((f, i) => sanitizeItem(f, `${i + 1}`, 0))
    .filter((f): f is SpecItem => f !== null);
  return clean.length > 0 ? { features: clean } : null;
}

function sanitizeItem(x: unknown, fallbackId: string, depth: number): SpecItem | null {
  if (!x || typeof x !== "object" || depth > 2) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return null;
  const rawPriority = typeof o.priority === "string" ? o.priority : "";
  const item: SpecItem = {
    id: typeof o.id === "string" && o.id.trim() ? o.id : fallbackId,
    title: o.title,
    desc: typeof o.desc === "string" ? o.desc : "",
    priority: PRIORITIES.has(rawPriority as SpecPriority)
      ? (rawPriority as SpecPriority)
      : PRIORITY_ALIAS[rawPriority] ?? "중간",
    status: STATUSES.has(o.status as SpecStatus) ? (o.status as SpecStatus) : "작성중",
  };
  if (Array.isArray(o.refs)) {
    const refs = o.refs.filter((ref): ref is string => typeof ref === "string" && /^REQ-\d+$/.test(ref));
    if (refs.length > 0) item.refs = refs;
  }
  if (typeof o.role === "string" && o.role) item.role = o.role;
  if (typeof o.device === "string" && o.device) item.device = o.device;
  if (Array.isArray(o.acceptance)) {
    const acc = o.acceptance.filter((a): a is string => typeof a === "string" && !!a.trim());
    if (acc.length > 0) item.acceptance = acc;
  }
  if (Array.isArray(o.children)) {
    const kids = o.children
      .map((c, i) => sanitizeItem(c, `${item.id}.${i + 1}`, depth + 1))
      .filter((c): c is SpecItem => c !== null);
    if (kids.length > 0) item.children = kids;
  }
  return item;
}

/** start 위치의 '{'에서 시작하는 균형 잡힌 JSON 객체 문자열을 잘라낸다 (문자열/이스케이프 인지). */
function extractBalancedObject(s: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function isValidDoc(doc: unknown): doc is Omit<PrdDoc, "version"> {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  return (
    typeof d.title === "string" &&
    typeof d.overview === "string" &&
    Array.isArray(d.goals) &&
    Array.isArray(d.requirements) &&
    Array.isArray(d.milestones)
  );
}

function isValidGraph(graph: unknown): graph is GraphSpec {
  if (!graph || typeof graph !== "object") return false;
  const g = graph as Record<string, unknown>;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return false;
  const ids = new Set(
    (g.nodes as { id?: unknown }[]).map((n) => n?.id).filter((x) => typeof x === "string"),
  );
  if (ids.size === 0) return false;
  // 노드에 없는 id를 참조하는 엣지는 제거
  g.edges = (g.edges as { source?: unknown; target?: unknown }[]).filter(
    (e) => typeof e?.source === "string" && typeof e?.target === "string" &&
      ids.has(e.source) && ids.has(e.target),
  );
  return true;
}
