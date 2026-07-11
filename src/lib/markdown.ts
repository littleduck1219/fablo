import type { GraphSpec, PrdDoc, SpecDoc, SpecItem, SpecPriority } from "./types";

const PRIORITY_EMOJI: Record<SpecPriority, string> = { 높음: "🔴", 중간: "🟡", 낮음: "🟢" };

/** 셀 안의 파이프/개행이 표를 깨지 않도록 정리 */
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

/** PRD 문서(+연결도)를 Markdown 문자열로 변환한다. 연결도는 mermaid로 포함. */
export function prdToMarkdown(doc: PrdDoc, graph: GraphSpec | null): string {
  const L: string[] = [];
  let section = 0;
  const heading = (title: string) => `## ${++section}. ${title}`;

  L.push(`# ${doc.title}`, "", `> PRD v${doc.version} · Fablo로 생성`, "");

  L.push(heading("개요"), "", doc.overview, "");
  L.push(heading("문제 정의"), "", doc.problem, "");

  if (doc.solution) L.push(heading("해결 전략"), "", doc.solution, "");
  if (doc.differentiators?.length) {
    L.push(heading("차별점"), "");
    for (const d of doc.differentiators) L.push(`- ${d}`);
    L.push("");
  }
  if (doc.scenarios?.length) {
    L.push(heading("핵심 사용자 시나리오"), "");
    for (const s of doc.scenarios) {
      L.push(`### ${s.name}`, "");
      s.steps.forEach((step, i) => L.push(`${i + 1}. ${step}`));
      L.push("");
    }
  }
  if (doc.roles?.length) L.push("**사용자 역할:** " + doc.roles.join(", "), "");
  if (doc.devices?.length) L.push("**대상 기기:** " + doc.devices.join(", "), "");

  L.push(heading("목표 및 성공 지표"), "", "| 지표 | 목표 |", "| --- | --- |");
  for (const g of doc.goals) L.push(`| ${cell(g.metric)} | ${cell(g.target)} |`);
  L.push("");

  L.push(heading("사용자 페르소나"), "");
  for (const p of doc.personas) L.push(`- **${p.name}** — ${p.desc}`);
  L.push("");

  L.push(
    heading("핵심 기능 요구사항"),
    "",
    "| ID | 기능 | 설명 | 우선순위 | 상태 |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const r of doc.requirements) {
    L.push(`| ${r.id} | ${cell(r.title)} | ${cell(r.desc)} | ${r.priority} | ${r.status} |`);
  }
  L.push("");

  L.push(heading("비기능 요구사항"), "");
  for (const n of doc.nonFunctional) L.push(`- ${n}`);
  L.push("");

  if (doc.risks?.length) {
    L.push(heading("리스크 및 대응"), "", "| 리스크 | 대응 |", "| --- | --- |");
    for (const r of doc.risks) L.push(`| ${cell(r.risk)} | ${cell(r.mitigation)} |`);
    L.push("");
  }

  L.push(heading("마일스톤"), "", "| 단계 | 범위 | 기간 |", "| --- | --- | --- |");
  for (const m of doc.milestones) L.push(`| ${cell(m.phase)} | ${cell(m.scope)} | ${cell(m.eta)} |`);
  L.push("");

  if (graph && graph.nodes.length > 0) {
    L.push(heading("기능 연결도"), "", "```mermaid", "flowchart LR");
    for (const n of graph.nodes) {
      const label = `${n.label}${n.ref ? ` (${n.ref})` : ""}`.replace(/"/g, "'");
      L.push(`  ${n.id}["${label}"]`);
    }
    for (const e of graph.edges) {
      const label = e.label?.replace(/"/g, "'");
      L.push(label ? `  ${e.source} -- ${label} --> ${e.target}` : `  ${e.source} --> ${e.target}`);
    }
    L.push("```", "");
  }

  return L.join("\n");
}

/* ---------- 기능명세서 내보내기 (AI 친화 — manifest 스타일) ---------- */

const HEAD = ["##", "###", "####"] as const;

function specItemLines(item: SpecItem, depth: number, L: string[]): void {
  const h = HEAD[Math.min(depth, HEAD.length - 1)];
  L.push(`${h} ${item.id} ${item.title}`, "");
  const meta = [
    `**중요도**: ${PRIORITY_EMOJI[item.priority]} ${item.priority}`,
    `**진행 상태**: ${item.status}${item.status === "검토중" ? " · PM 제안" : ""}`,
    item.refs?.length && `**연결 요구사항**: ${item.refs.join(", ")}`,
    item.role && `**역할**: ${item.role}`,
    item.device && `**기기**: ${item.device}`,
  ].filter(Boolean);
  L.push(`> ${meta.join(" | ")}`, "");
  if (item.desc) L.push(item.desc, "");
  if (item.acceptance?.length) {
    L.push("**수용 기준:**", "");
    item.acceptance.forEach((a, i) => L.push(`${i + 1}. ○ ${a}`));
    L.push("");
  }
  for (const child of item.children ?? []) specItemLines(child, depth + 1, L);
}

/** 기능명세서(+PRD 개요)를 AI 도구가 바로 쓸 수 있는 Markdown으로 변환한다. */
export function specToMarkdown(doc: PrdDoc, spec: SpecDoc): string {
  const L: string[] = [];

  L.push(`# ${doc.title} — 기능명세서`, "", `> v${doc.version} · Fablo로 생성`, "");

  L.push("## 1. 프로젝트 개요", "");
  L.push("### 개요", "", doc.overview, "");
  L.push("### 문제 정의", "", doc.problem, "");
  if (doc.solution) L.push("### 해결 전략", "", doc.solution, "");
  if (doc.differentiators?.length) {
    L.push("### 차별점", "");
    for (const d of doc.differentiators) L.push(`- ${d}`);
    L.push("");
  }
  if (doc.scenarios?.length) {
    L.push("### 핵심 사용자 시나리오", "");
    for (const s of doc.scenarios) L.push(`- **${s.name}** — ${s.steps.join(" → ")}`);
    L.push("");
  }
  if (doc.risks?.length) {
    L.push("### 리스크 및 대응", "");
    for (const r of doc.risks) L.push(`- **${r.risk}** — ${r.mitigation}`);
    L.push("");
  }
  L.push("### 목표 및 성공 지표", "", "| 지표 | 목표 |", "| --- | --- |");
  for (const g of doc.goals) L.push(`| ${cell(g.metric)} | ${cell(g.target)} |`);
  L.push("");
  L.push("### 타겟 사용자", "");
  for (const p of doc.personas) L.push(`- **${p.name}** — ${p.desc}`);
  L.push("");
  L.push("### 비기능 요구사항", "");
  for (const n of doc.nonFunctional) L.push(`- ${n}`);
  L.push("");

  L.push("## 2. 주요 기능 목록", "", "---", "");
  for (const f of spec.features) {
    specItemLines(f, 0, L);
    L.push("---", "");
  }

  // 연결도 — 계층을 mermaid 트리로
  L.push("## 3. 기능 연결도", "", "```mermaid", "flowchart LR");
  const mmId = (id: string) => `n${id.replace(/\./g, "_")}`;
  const mmLabel = (s: string) => s.replace(/"/g, "'");
  L.push(`  root["${mmLabel(doc.title.split("—")[0].trim())}"]`);
  const walk = (item: SpecItem, parent: string) => {
    L.push(`  ${mmId(item.id)}["${item.id} ${mmLabel(item.title)}"]`);
    L.push(`  ${parent} --> ${mmId(item.id)}`);
    for (const c of item.children ?? []) walk(c, mmId(item.id));
  };
  for (const f of spec.features) walk(f, "root");
  L.push("```", "");

  return L.join("\n");
}

function download(md: string, filename: string): void {
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const safeName = (title: string) =>
  title.split("—")[0].trim().replace(/[\\/:*?"<>|]/g, "").slice(0, 60);

/** PRD Markdown 파일로 다운로드한다. */
export function downloadPrdMarkdown(doc: PrdDoc, graph: GraphSpec | null): void {
  download(prdToMarkdown(doc, graph), `${safeName(doc.title) || "PRD"} PRD v${doc.version}.md`);
}

/** 기능명세서 Markdown 파일로 다운로드한다. */
export function downloadSpecMarkdown(doc: PrdDoc, spec: SpecDoc): void {
  download(specToMarkdown(doc, spec), `${safeName(doc.title) || "명세"} 기능명세서 v${doc.version}.md`);
}
