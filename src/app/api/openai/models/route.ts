/**
 * ChatGPT Codex 백엔드 모델 카탈로그 프록시.
 * Codex CLI와 동일하게 GET /backend-api/codex/models 에서 계정이 사용 가능한
 * 모델 슬러그 목록을 가져온다 (하드코딩 목록의 드리프트 방지).
 */
export async function POST(request: Request): Promise<Response> {
  let body: { accessToken?: string; accountId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body.accessToken || !body.accountId) {
    return Response.json({ error: "missing accessToken/accountId" }, { status: 400 });
  }

  const upstream = await fetch(
    "https://chatgpt.com/backend-api/codex/models?client_version=0.55.0",
    {
      headers: {
        authorization: `Bearer ${body.accessToken}`,
        "chatgpt-account-id": body.accountId,
        accept: "application/json",
        originator: "codex_cli_rs",
        session_id: crypto.randomUUID(),
      },
    },
  );

  const text = await upstream.text();
  if (!upstream.ok) {
    console.error(`[fablo] codex/models ${upstream.status}:`, text.slice(0, 1000));
  } else {
    // 카탈로그 슬러그 진단 로그 (모델명만)
    try {
      const j = JSON.parse(text);
      const slugs = Array.isArray(j?.models)
        ? j.models.map((m: { slug?: string; id?: string; model?: string }) => m?.slug ?? m?.id ?? m?.model)
        : `unexpected shape: ${Object.keys(j ?? {}).join(",")}`;
      console.log("[fablo] codex/models catalog:", JSON.stringify(slugs).slice(0, 800));
    } catch {
      console.log("[fablo] codex/models non-JSON:", text.slice(0, 300));
    }
  }
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
