import type { PrdDoc } from "./types";

const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]))
      : value;

/** 버전과 JSON 키 순서를 제외한 PRD 내용 비교. */
export function samePrdContent(current: PrdDoc, incoming: Omit<PrdDoc, "version">): boolean {
  const { version: _version, ...content } = current;
  return JSON.stringify(stable(content)) === JSON.stringify(stable(incoming));
}
