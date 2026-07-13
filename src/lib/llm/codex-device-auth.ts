import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { getFabloCodexHome, resetServerChatGptTokenCache } from "./server-chatgpt";

export type DeviceLogin = {
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type DeviceLoginStatus = {
  status: "pending" | "complete" | "error" | "cancelled";
  error?: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class CodexDeviceAuthServer {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private logins = new Map<string, DeviceLoginStatus>();
  private ready: Promise<void>;
  private stopped = false;
  private stderr = "";

  constructor() {
    const codexHome = getFabloCodexHome();
    mkdirSync(codexHome, { recursive: true, mode: 0o700 });
    const codexScript = join(process.cwd(), "node_modules", "@openai", "codex", "bin", "codex.js");
    this.child = spawn(
      process.execPath,
      [codexScript, "app-server", "--stdio", "-c", 'cli_auth_credentials_store="file"'],
      { env: { ...process.env, CODEX_HOME: codexHome }, stdio: ["pipe", "pipe", "pipe"] },
    );

    createInterface({ input: this.child.stdout }).on("line", (line) => this.handleLine(line));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${String(chunk)}`.slice(-2000);
    });
    const stop = (cause?: Error) => {
      this.stopped = true;
      const error = cause ?? new Error(this.stderr.trim() || "Codex app-server가 종료되었습니다.");
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
      }
      this.pending.clear();
    };
    this.child.once("error", stop);
    this.child.once("exit", () => stop());

    this.ready = this.requestRaw("initialize", {
      clientInfo: { name: "fablo", title: "Fablo", version: "0.1.0" },
    }).then(() => {
      this.write({ method: "initialized" });
    });
  }

  isRunning(): boolean {
    return !this.stopped;
  }

  async start(): Promise<DeviceLogin> {
    await this.ready;
    const result = (await this.requestRaw("account/login/start", {
      type: "chatgptDeviceCode",
    })) as DeviceLogin & { type: string };
    this.logins.set(result.loginId, { status: "pending" });
    return {
      loginId: result.loginId,
      verificationUrl: result.verificationUrl,
      userCode: result.userCode,
    };
  }

  status(loginId: string): DeviceLoginStatus {
    return this.logins.get(loginId) ?? { status: "error", error: "로그인 요청을 찾을 수 없습니다." };
  }

  async cancel(loginId: string): Promise<void> {
    await this.ready;
    await this.requestRaw("account/login/cancel", { loginId });
    this.logins.set(loginId, { status: "cancelled" });
  }

  private handleLine(line: string): void {
    let message: {
      id?: number;
      result?: unknown;
      error?: { message?: string };
      method?: string;
      params?: { loginId?: string; success?: boolean; error?: string | null };
    };
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (typeof message.id === "number") {
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message || "Codex 요청에 실패했습니다."));
      else request.resolve(message.result);
      return;
    }

    if (message.method === "account/login/completed" && message.params?.loginId) {
      const { loginId, success, error } = message.params;
      this.logins.set(
        loginId,
        success ? { status: "complete" } : { status: "error", error: error || "로그인에 실패했습니다." },
      );
      if (success) resetServerChatGptTokenCache();
    }
  }

  private requestRaw(method: string, params: unknown): Promise<unknown> {
    if (this.stopped) return Promise.reject(new Error("Codex app-server가 실행 중이 아닙니다."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Codex app-server 응답 시간이 초과되었습니다."));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ method, id, params });
    });
  }

  private write(message: unknown): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }
}

const shared = globalThis as typeof globalThis & { fabloCodexDeviceAuth?: CodexDeviceAuthServer };

export function getCodexDeviceAuthServer(): CodexDeviceAuthServer {
  if (!shared.fabloCodexDeviceAuth?.isRunning()) {
    shared.fabloCodexDeviceAuth = new CodexDeviceAuthServer();
  }
  return shared.fabloCodexDeviceAuth;
}
