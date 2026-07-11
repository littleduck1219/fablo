import assert from "node:assert/strict";
import test from "node:test";
import { extractQuestions, generationProgress, sanitizeSpec, visibleText } from "./parse.ts";

test("visibleText hides everything after the marker", () => {
  assert.equal(visibleText('답변입니다.\n<<<PRD_JSON>>>\n{"doc":{'), "답변입니다.");
});

test("generationProgress is null before any payload starts", () => {
  assert.equal(generationProgress("아직 대화 답변만 쓰는 중"), null);
});

test("generationProgress tracks the last section seen in the hidden JSON", () => {
  const full = '답변.\n<<<PRD_JSON>>>\n{"doc":{"title":"X","overview":"…","problem":"…","goals":[';
  const p = generationProgress(full);
  assert.ok(p);
  assert.equal(p.current, "목표·성공 지표");
  assert.deepEqual(p.done, ["제목", "개요", "문제 정의"]);
});

test("generationProgress reports skeleton right after the marker", () => {
  assert.deepEqual(generationProgress("답변.\n<<<PRD_JSON>>>\n{"), { done: [], current: "문서 뼈대" });
});

test("generationProgress works for marker-less JSON output (fallback)", () => {
  const p = generationProgress('{"doc":{"title":"X","overview":"…"');
  assert.ok(p);
  assert.equal(p.current, "개요");
});

test("generationProgress shows 기능명세서 while writing spec, doc sections as done", () => {
  const full =
    '답.\n<<<PRD_JSON>>>\n{"doc":{"title":"X","overview":"o","milestones":[]},"spec":{"features":[{"id":"1","title":"기능"';
  const p = generationProgress(full);
  assert.ok(p);
  assert.equal(p.current, "기능명세서");
  assert.deepEqual(p.done, ["제목", "개요", "마일스톤"]);
});

test("generationProgress does not mistake nested spec keys for doc sections", () => {
  // spec 항목 안의 "title"이 doc 섹션 진행으로 잡히면 안 된다
  const full = '답.\n<<<PRD_JSON>>>\n{"spec":{"features":[{"id":"1","title":"기능","desc":"d"}]},"doc":{"title":"X","problem":"p"';
  const p = generationProgress(full);
  assert.ok(p);
  assert.equal(p.current, "문제 정의");
  assert.ok(p.done.includes("기능명세서"));
});

const ASK = '질문이 있어요.\n<<<ASK_JSON>>>\n{"questions":[{"q":"타깃","options":["창업자","PM"]}]}';

test("visibleText hides the ask payload", () => {
  assert.equal(visibleText(ASK), "질문이 있어요.");
});

test("generationProgress shows feedback during an ask payload", () => {
  assert.deepEqual(generationProgress(ASK), { done: [], current: "선택지" });
});

test("extractQuestions parses the ask payload", () => {
  assert.deepEqual(extractQuestions(ASK), [{ q: "타깃", options: ["창업자", "PM"], multi: false }]);
});

test("extractQuestions keeps the multi flag", () => {
  const full = '<<<ASK_JSON>>>\n{"questions":[{"q":"어려움","options":["a","b"],"multi":true}]}';
  assert.deepEqual(extractQuestions(full), [{ q: "어려움", options: ["a", "b"], multi: true }]);
});

test("extractQuestions is null without a questions payload", () => {
  assert.equal(extractQuestions("그냥 대화 답변"), null);
});

test("sanitizeSpec normalizes priorities/status and fills missing ids", () => {
  const spec = sanitizeSpec({
    features: [
      {
        title: "모델 연동",
        desc: "…",
        priority: "P0",
        refs: ["REQ-001", "잘못된-ID"],
        children: [{ id: "1.1", title: "키 등록", desc: "…", priority: "높음", status: "확정" }],
      },
      { desc: "제목 없는 항목은 버려진다" },
    ],
  });
  assert.ok(spec);
  assert.equal(spec.features.length, 1);
  assert.equal(spec.features[0].id, "1");
  assert.equal(spec.features[0].priority, "높음");
  assert.equal(spec.features[0].status, "작성중");
  assert.deepEqual(spec.features[0].refs, ["REQ-001"]);
  assert.equal(spec.features[0].children?.[0].status, "확정");
});

test("sanitizeSpec is null for empty or malformed input", () => {
  assert.equal(sanitizeSpec({ features: [] }), null);
  assert.equal(sanitizeSpec("문자열"), null);
});
