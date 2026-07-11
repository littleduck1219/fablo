import assert from "node:assert/strict";
import test from "node:test";
import { prdToMarkdown, specToMarkdown } from "./markdown.ts";
import { samePrdContent } from "./prd.ts";
import type { PrdDoc, SpecDoc } from "./types.ts";

const doc: PrdDoc = {
  title: "Fablo — AI 설계 문서 도구",
  version: 2,
  overview: "개요",
  problem: "문제",
  solution: "해결 전략",
  differentiators: ["명확한 차별점"],
  scenarios: [{ name: "첫 사용", steps: ["시작", "완료"] }],
  risks: [{ risk: "낮은 채택", mitigation: "온보딩 개선" }],
  roles: ["PM"],
  devices: ["web"],
  goals: [{ metric: "지표", target: "목표" }],
  personas: [{ name: "PM", desc: "설명" }],
  requirements: [],
  nonFunctional: ["보안"],
  milestones: [],
};

const spec: SpecDoc = {
  features: [
    {
      id: "1",
      title: "외부 AI 모델 연동",
      desc: "설명",
      priority: "높음",
      status: "작성중",
      refs: ["REQ-001"],
      acceptance: ["2개 이상 모델"],
      children: [
        {
          id: "1.1",
          title: "커넥터 관리 (수정됨)",
          desc: "제공자별 연결",
          priority: "높음",
          status: "검토중",
          role: "user",
          device: "web",
        },
      ],
    },
  ],
};

test("specToMarkdown renders hierarchy, meta, acceptance, and mermaid tree", () => {
  const md = specToMarkdown(doc, spec);
  assert.ok(md.includes("# Fablo — AI 설계 문서 도구 — 기능명세서"));
  assert.ok(md.includes("### 해결 전략"));
  assert.ok(md.includes("### 차별점"));
  assert.ok(md.includes("**첫 사용** — 시작 → 완료"));
  assert.ok(md.includes("**낮은 채택** — 온보딩 개선"));
  assert.ok(md.includes("## 1 외부 AI 모델 연동"));
  assert.ok(md.includes("### 1.1 커넥터 관리 (수정됨)"));
  assert.ok(md.includes("**중요도**: 🔴 높음"));
  assert.ok(md.includes("**연결 요구사항**: REQ-001"));
  assert.ok(md.includes("**진행 상태**: 검토중 · PM 제안"));
  assert.ok(md.includes("**역할**: user | **기기**: web"));
  assert.ok(md.includes("1. ○ 2개 이상 모델"));
  assert.ok(md.includes("flowchart LR"));
  assert.ok(md.includes('n1_1["1.1 커넥터 관리 (수정됨)"]'));
});

test("prdToMarkdown numbers optional sections without duplicates", () => {
  const headings = prdToMarkdown(doc, null)
    .split("\n")
    .filter((line) => /^## \d+\./.test(line));
  assert.deepEqual(headings.map((line) => Number(/^## (\d+)\./.exec(line)?.[1])),
    headings.map((_, i) => i + 1));
});

test("samePrdContent ignores version and object key order", () => {
  const { version: _version, ...incoming } = doc;
  const reordered = Object.fromEntries(Object.entries(incoming).reverse()) as Omit<PrdDoc, "version">;
  assert.equal(samePrdContent(doc, reordered), true);
  assert.equal(samePrdContent(doc, { ...incoming, title: "변경됨" }), false);
});
