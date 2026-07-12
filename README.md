# Fablo

대화로 제품 아이디어를 PRD와 개발 가능한 기능명세서·연결도로 구체화하는 AI 제품 기획 워크스페이스입니다.

Fablo는 정해진 질문지를 채우는 대신 제품 고유의 불확실성을 인터뷰하고, 사용자가 말하지 않은 필수 요구사항을 PM 관점에서 제안합니다. 제안된 내용은 `검토중 · PM 제안`으로 구분하며, PRD 요구사항과 기능명세서의 연결 관계를 추적합니다.

## 주요 기능

- 제품 아이디어에서 파생된 대화형 인터뷰
- 해결 전략, 차별점, 사용자 시나리오, 리스크와 대응을 포함한 PRD 생성
- 요구사항 → 기능 → 상세 기능의 3단 기능명세서와 연결도
- PRD 요구사항 ID와 기능명세서 간 추적
- 상태 전이, 예외 흐름, 역할·기기, 수용 기준 자기 감사
- PRD 및 기능명세서 인라인 편집
- 다중 문서 보관함, 버전 히스토리, PRD 템플릿
- Markdown 복사·내보내기와 JSON 백업·복원
- Anthropic, OpenAI, Google Gemini, OpenRouter, Ollama 연결
- ChatGPT 구독 OAuth 및 Codex 인증 파일 연결

## 실행

필요 환경: Node.js 20+, npm

```bash
git clone https://github.com/littleduck1219/fablo.git
cd fablo
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 실행됩니다.

별도 데이터베이스나 환경 변수는 필요하지 않습니다. 앱에서 사용할 모델 제공자를 직접 연결하세요.

## 사용 흐름

1. 모델 제공자를 연결합니다.
2. 만들고 싶은 제품 아이디어를 설명합니다.
3. 제품 방향을 결정하는 인터뷰에 답합니다.
4. 생성된 PRD를 확인하고 대화 또는 인라인 편집으로 보완합니다.
5. 기능명세서를 생성해 요구사항, 기능, 상세 기능과 연결도를 검토합니다.
6. Markdown으로 복사하거나 내보냅니다.

## 데이터와 자격 증명

- 대화, 문서, 설정, API 자격 증명은 브라우저 `localStorage`의 `fablo:v1`에 저장됩니다.
- Anthropic, OpenAI API, Gemini, OpenRouter, Ollama 요청은 브라우저에서 각 제공자로 직접 전송됩니다.
- ChatGPT 구독 연결은 CORS 처리를 위해 무상태 Next.js 프록시를 사용하며 토큰을 서버에 저장하지 않습니다.
- JSON 백업에는 API 자격 증명이 포함될 수 있으므로 안전하게 보관하세요.
- 공용 컴퓨터나 신뢰할 수 없는 배포 환경에서는 자격 증명을 저장하지 마세요.

## 개발 명령

```bash
npm run dev        # 개발 서버
npm test           # Node 내장 테스트
npx tsc --noEmit   # 타입 검사
npm run build      # 프로덕션 빌드
npm run lint       # ESLint
```

## 기술 스택

- Next.js 16 App Router
- React 19, TypeScript
- Tailwind CSS 4
- React Flow
- Anthropic SDK 및 제공자별 스트리밍 API

## 현재 범위

Fablo는 로컬 우선 프로토타입입니다. 사용자 계정, 팀 협업 백엔드, 클라우드 동기화, 서버 측 비밀 저장소는 아직 제공하지 않습니다.
