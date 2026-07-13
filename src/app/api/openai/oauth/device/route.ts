import { getCodexDeviceAuthServer } from "@/lib/llm/codex-device-auth";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    return Response.json(await getCodexDeviceAuthServer().start());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "디바이스 로그인을 시작하지 못했습니다." },
      { status: 503 },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  const loginId = new URL(request.url).searchParams.get("loginId");
  if (!loginId) return Response.json({ error: "missing loginId" }, { status: 400 });
  return Response.json(getCodexDeviceAuthServer().status(loginId));
}

export async function DELETE(request: Request): Promise<Response> {
  const loginId = new URL(request.url).searchParams.get("loginId");
  if (!loginId) return Response.json({ error: "missing loginId" }, { status: 400 });
  try {
    await getCodexDeviceAuthServer().cancel(loginId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "로그인 취소에 실패했습니다." },
      { status: 503 },
    );
  }
}
