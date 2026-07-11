/**
 * ChatGPT Codex 백엔드(Responses API) 스트리밍 프록시.
 * 구독 OAuth 토큰으로 chatgpt.com/backend-api/codex/responses 를 호출하고
 * SSE 응답 본문을 그대로 통과시킨다. 토큰은 요청마다 클라이언트가 전달하며 저장하지 않는다.
 */
export async function POST(request: Request): Promise<Response> {
  let body: {
    accessToken?: string;
    accountId?: string;
    payload?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.accessToken || !body.accountId || !body.payload) {
    return Response.json({ error: "missing accessToken/accountId/payload" }, { status: 400 });
  }

  const upstream = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${body.accessToken}`,
      "chatgpt-account-id": body.accountId,
      "content-type": "application/json",
      accept: "text/event-stream",
      "openai-beta": "responses=experimental",
      originator: "codex_cli_rs",
      session_id: crypto.randomUUID(),
    },
    body: JSON.stringify(body.payload),
  });

  // 에러 응답은 본문을 읽어 서버 로그에 남기고 그대로 전달 (스키마 진단용)
  if (!upstream.ok) {
    const text = await upstream.text();
    console.error(`[fablo] codex/responses ${upstream.status}:`, text.slice(0, 2000));
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
