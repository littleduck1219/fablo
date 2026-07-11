export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  pending?: boolean;
  error?: boolean;
  /** 문서 생성 중 진행 표시 (스트리밍 동안만 존재, 완료 시 제거) */
  progress?: { done: string[]; current: string };
  /** 인터뷰 질문 턴의 클릭용 선택지 (multi: 복수 선택 허용) */
  questions?: { q: string; options: string[]; multi?: boolean }[];
};

export type Priority = "P0" | "P1" | "P2";
export type ReqStatus = "확정" | "검토중" | "초안";

export type Requirement = {
  id: string;
  title: string;
  desc: string;
  priority: Priority;
  status: ReqStatus;
};

export type PrdDoc = {
  title: string;
  version: number;
  overview: string;
  problem: string;
  /** 구버전 문서에는 없을 수 있음 */
  solution?: string;
  differentiators?: string[];
  scenarios?: { name: string; steps: string[] }[];
  risks?: { risk: string; mitigation: string }[];
  roles?: string[];
  devices?: string[];
  goals: { metric: string; target: string }[];
  personas: { name: string; desc: string }[];
  requirements: Requirement[];
  nonFunctional: string[];
  milestones: { phase: string; scope: string; eta: string }[];
};

/* ---------- 기능명세서 (요구사항 → 기능 → 상세 기능 3단 계층) ---------- */

export type SpecPriority = "높음" | "중간" | "낮음";
export type SpecStatus = "작성중" | "검토중" | "확정";

export type SpecItem = {
  /** 계층 번호 — "1", "1.1", "1.1.1" */
  id: string;
  title: string;
  desc: string;
  priority: SpecPriority;
  status: SpecStatus;
  /** 이 기능이 구체화하는 PRD 요구사항 ID */
  refs?: string[];
  /** 사용 주체 (예: user, 관리자) */
  role?: string;
  /** 대상 기기 (예: web, iOS) */
  device?: string;
  /** 수용 기준 — 주로 최상위(주요 기능)에만 */
  acceptance?: string[];
  children?: SpecItem[];
};

/** 기능명세서 — 연결도의 원본이자 AI용 내보내기의 본문 */
export type SpecDoc = {
  features: SpecItem[];
};

/** 문서 버전 스냅샷 — LLM 갱신·복원 직전의 doc+graph+spec 한 벌 */
export type DocSnapshot = {
  version: number;
  savedAt: number;
  doc: PrdDoc;
  graph: GraphSpec | null;
  /** 구버전 스냅샷엔 없을 수 있음 */
  spec?: SpecDoc | null;
};

/** 대화 + 문서 + 연결도 한 벌 — 문서 보관함의 단위 */
export type Session = {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  doc: PrdDoc | null;
  graph: GraphSpec | null;
  /** 기능명세서 — 구버전 저장분엔 없을 수 있음 */
  spec?: SpecDoc | null;
  /** 과거 버전 스냅샷 (오래된 것부터, 최근 20개) — 구버전 저장분엔 없을 수 있음 */
  history?: DocSnapshot[];
};

export type ProviderStatus = "connected" | "disconnected" | "connecting";

export type Provider = {
  id: string;
  name: string;
  models: string[];
  status: ProviderStatus;
  /** API 키 대신 엔드포인트를 쓰는 로컬 런타임 여부 (예: Ollama) */
  local?: boolean;
  /** 실제 자격 증명 (API 키 또는 로컬 엔드포인트 URL) — 브라우저에만 저장 */
  credential?: string;
  keyMask?: string;
};

export type ActiveModel = {
  providerId: string;
  model: string;
} | null;

export type NodeKind = "actor" | "screen" | "feature" | "service" | "data";

/* ---------- 연결도 스펙 (LLM 출력 및 렌더링 공용) ---------- */

export type GraphNodeSpec = {
  id: string;
  label: string;
  kind: NodeKind;
  /** 연결된 요구사항 ID (예: REQ-001) */
  ref?: string;
  /** 수동 배치 좌표 — 없으면 자동 레이아웃 */
  position?: { x: number; y: number };
};

export type GraphEdgeSpec = {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
};

export type GraphSpec = {
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
};
