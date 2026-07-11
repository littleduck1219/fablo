/**
 * auth.openai.com 토큰 엔드포인트 프록시.
 * 브라우저에서 직접 호출하면 CORS로 막히므로 서버(라우트 핸들러)에서 중계한다.
 * 토큰은 저장하지 않고 그대로 통과시킨다.
 */
export async function POST(request: Request): Promise<Response> {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const upstream = await fetch("https://auth.openai.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
