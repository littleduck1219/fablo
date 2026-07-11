/**
 * ChatGPT OAuth 콜백 리스너.
 * Codex OAuth 클라이언트의 redirect_uri는 http://localhost:1455/auth/callback 로 고정이므로,
 * Next 서버가 뜰 때 1455 포트에 작은 리스너를 함께 띄워 콜백을 받아
 * 앱(?oauth=openai&code=…)으로 302 리디렉션한다. 이미 사용 중이면 조용히 건너뛴다
 * (그 경우 다이얼로그의 URL 붙여넣기 폴백을 사용).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { createServer } = await import("node:http");
  const appPort = process.env.PORT ?? "3000";

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost:1455");
    if (url.pathname === "/auth/callback") {
      const target = `http://localhost:${appPort}/?oauth=openai&${url.searchParams.toString()}`;
      res.statusCode = 302;
      res.setHeader("location", target);
      res.end();
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn("[fablo] 1455 포트가 사용 중이라 OAuth 콜백 리스너를 건너뜁니다 (URL 붙여넣기로 로그인 가능).");
    } else {
      console.warn("[fablo] OAuth 콜백 리스너 오류:", err.message);
    }
  });

  server.unref();
  server.listen(1455);
}
