import type { PrdDoc } from "@/lib/types";

export type PrdTemplate = {
  id: string;
  name: string;
  desc: string;
  doc: PrdDoc;
};

/** 시작점용 PRD 뼈대 — 적용 후 인라인 편집하거나 대화로 채워 넣는다. */
export const PRD_TEMPLATES: PrdTemplate[] = [
  {
    id: "lean-mvp",
    name: "린 MVP",
    desc: "핵심 가설 하나를 검증하는 최소 제품",
    doc: {
      title: "제품 이름 — 한 줄 콘셉트",
      version: 1,
      overview: "누구의 어떤 문제를, 어떤 방식으로 해결하는 제품인지 2~3문장으로.",
      problem: "검증하려는 핵심 가설과, 지금 사용자가 겪는 불편을 구체적 상황으로.",
      goals: [
        { metric: "핵심 가설 검증", target: "첫 4주 내 활성 사용자 N명" },
        { metric: "리텐션", target: "주간 재방문율 X%" },
      ],
      personas: [{ name: "얼리어답터", desc: "문제를 가장 크게 겪고 있어 불완전한 제품도 써 볼 사용자" }],
      requirements: [
        { id: "REQ-001", title: "핵심 기능", desc: "가설을 검증하는 단 하나의 핵심 플로우", priority: "P0", status: "초안" },
        { id: "REQ-002", title: "온보딩", desc: "가입 없이(또는 최소 가입으로) 핵심 기능까지 도달", priority: "P1", status: "초안" },
        { id: "REQ-003", title: "피드백 수집", desc: "사용자 반응을 측정할 최소한의 이벤트 로깅", priority: "P1", status: "초안" },
      ],
      nonFunctional: ["빠른 배포 주기 — 주 1회 이상 릴리스 가능한 구조"],
      milestones: [
        { phase: "M1", scope: "핵심 플로우 동작", eta: "2주" },
        { phase: "M2", scope: "베타 사용자 테스트", eta: "4주" },
      ],
    },
  },
  {
    id: "mobile-app",
    name: "모바일 앱",
    desc: "iOS/Android 소비자 앱 기본 골격",
    doc: {
      title: "앱 이름 — 한 줄 콘셉트",
      version: 1,
      overview: "모바일에서 어떤 일상 문제를 해결하는 앱인지, 왜 모바일이어야 하는지.",
      problem: "타깃 사용자가 이동 중·짧은 시간에 겪는 문제와 기존 대안의 한계.",
      goals: [
        { metric: "설치 후 활성화", target: "D1 활성화율 X%" },
        { metric: "리텐션", target: "D30 리텐션 X%" },
      ],
      personas: [
        { name: "주 사용자", desc: "하루 중 짧은 틈에 앱을 여는 핵심 타깃" },
        { name: "라이트 사용자", desc: "알림·위젯 등 수동적 접점 위주로 쓰는 사용자" },
      ],
      requirements: [
        { id: "REQ-001", title: "핵심 화면", desc: "앱을 여는 이유가 되는 메인 화면과 핵심 액션", priority: "P0", status: "초안" },
        { id: "REQ-002", title: "온보딩", desc: "3화면 이내 가치 설명 + 권한 요청 최소화", priority: "P0", status: "초안" },
        { id: "REQ-003", title: "푸시 알림", desc: "재방문을 만드는 핵심 알림 1종", priority: "P1", status: "초안" },
        { id: "REQ-004", title: "오프라인 동작", desc: "네트워크 없이도 최근 데이터 열람", priority: "P2", status: "초안" },
      ],
      nonFunctional: ["콜드 스타트 2초 이내", "iOS·Android 동시 지원"],
      milestones: [
        { phase: "M1", scope: "핵심 화면 + 온보딩", eta: "4주" },
        { phase: "M2", scope: "알림 + 스토어 심사", eta: "8주" },
      ],
    },
  },
  {
    id: "b2b-saas",
    name: "B2B SaaS",
    desc: "팀 단위 도입형 SaaS 기본 골격",
    doc: {
      title: "서비스 이름 — 한 줄 콘셉트",
      version: 1,
      overview: "어떤 팀의 어떤 업무 흐름을 대체·개선하는 SaaS인지.",
      problem: "현재 업무 방식(스프레드시트·수작업 등)의 비용과, 도입 결정권자가 느끼는 통증.",
      goals: [
        { metric: "유료 전환", target: "트라이얼 → 유료 전환율 X%" },
        { metric: "팀 확산", target: "계정당 평균 시트 수 N개" },
      ],
      personas: [
        { name: "실무자", desc: "매일 쓰는 엔드 유저 — 도입 후 만족도를 좌우" },
        { name: "도입 결정권자", desc: "비용·보안·온보딩 부담을 따지는 팀 리드/관리자" },
      ],
      requirements: [
        { id: "REQ-001", title: "핵심 워크플로", desc: "기존 업무를 대체하는 메인 기능", priority: "P0", status: "초안" },
        { id: "REQ-002", title: "팀 초대·권한", desc: "멤버 초대, 역할(관리자/멤버) 구분", priority: "P0", status: "초안" },
        { id: "REQ-003", title: "온보딩", desc: "샘플 데이터로 5분 내 핵심 가치 체험", priority: "P1", status: "초안" },
        { id: "REQ-004", title: "결제·플랜", desc: "시트 기반 과금, 트라이얼 만료 처리", priority: "P1", status: "초안" },
      ],
      nonFunctional: ["SSO 등 기업 보안 요구 대응 여지", "감사 로그"],
      milestones: [
        { phase: "M1", scope: "핵심 워크플로 + 팀 기능", eta: "6주" },
        { phase: "M2", scope: "결제 + 파일럿 고객", eta: "10주" },
      ],
    },
  },
];
