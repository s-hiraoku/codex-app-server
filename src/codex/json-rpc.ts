import { spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { ApiError } from "../utils/errors.js";

export type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  id: number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type JsonRpcRequest = {
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcProcess = {
  stdout: Readable;
  stdin: Writable;
  once(event: "error", listener: (error: Error) => void): unknown;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  kill(): unknown;
};

export interface JsonRpcTransport {
  request<T>(method: string, params?: unknown): Promise<T>;
  notify(method: string, params?: unknown): void;
  waitForNotification(
    predicate: (notification: JsonRpcNotification) => boolean,
    timeoutMs: number
  ): Promise<JsonRpcNotification>;
  close(): void;
}

export class StdioJsonRpcTransport implements JsonRpcTransport {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notificationWaiters: Array<{
    predicate: (notification: JsonRpcNotification) => boolean;
    resolve: (notification: JsonRpcNotification) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private readonly proc: JsonRpcProcess;
  private readonly rl: Interface;

  constructor(command: string, args: string[], env: NodeJS.ProcessEnv, proc?: JsonRpcProcess) {
    this.proc = proc ?? spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env
    });
    this.rl = createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this.handleLine(line));
    this.proc.once("error", (error) => this.failAll(new ApiError("CODEX_NOT_CONFIGURED", error.message)));
    this.proc.once("exit", (code, signal) => {
      this.failAll(new ApiError("CODEX_EXECUTION_FAILED", `Codex app-server exited (${code ?? signal ?? "unknown"})`));
    });
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const message = params === undefined ? { method, id } : { method, id, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject
      });
      this.write(message, reject);
    });
  }

  notify(method: string, params?: unknown): void {
    this.write(params === undefined ? { method } : { method, params });
  }

  waitForNotification(
    predicate: (notification: JsonRpcNotification) => boolean,
    timeoutMs: number
  ): Promise<JsonRpcNotification> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.notificationWaiters.findIndex((waiter) => waiter.reject === reject);
        if (index >= 0) {
          this.notificationWaiters.splice(index, 1);
        }
        reject(new ApiError("CODEX_EXECUTION_FAILED", "Timed out waiting for Codex app-server notification"));
      }, timeoutMs);

      this.notificationWaiters.push({ predicate, resolve, reject, timeout });
    });
  }

  close(): void {
    this.rl.close();
    this.proc.kill();
  }

  private write(message: unknown, reject?: (error: Error) => void): void {
    const payload = `${JSON.stringify(message)}\n`;
    this.proc.stdin.write(payload, (error) => {
      if (error && reject) {
        reject(error);
      }
    });
  }

  private handleLine(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (!message || typeof message !== "object") {
      return;
    }

    const maybeResponse = message as Partial<JsonRpcResponse>;
    if (typeof maybeResponse.id === "number" && this.pending.has(maybeResponse.id)) {
      const pending = this.pending.get(maybeResponse.id);
      this.pending.delete(maybeResponse.id);
      if (!pending) {
        return;
      }
      if (maybeResponse.error) {
        pending.reject(new Error(maybeResponse.error.message ?? "Codex app-server request failed"));
        return;
      }
      pending.resolve(maybeResponse.result);
      return;
    }

    if (typeof maybeResponse.id === "number" && typeof (message as Partial<JsonRpcRequest>).method === "string") {
      this.rejectServerRequest(message as JsonRpcRequest);
      return;
    }

    const maybeNotification = message as Partial<JsonRpcNotification>;
    if (typeof maybeNotification.method === "string") {
      this.resolveNotification({ method: maybeNotification.method, params: maybeNotification.params });
    }
  }

  private rejectServerRequest(request: JsonRpcRequest): void {
    this.write({
      id: request.id,
      error: {
        code: -32000,
        message: `Gateway does not permit Codex app-server request: ${request.method}`
      }
    });
  }

  private resolveNotification(notification: JsonRpcNotification): void {
    for (const waiter of [...this.notificationWaiters]) {
      if (!waiter.predicate(notification)) {
        continue;
      }
      clearTimeout(waiter.timeout);
      const index = this.notificationWaiters.indexOf(waiter);
      if (index >= 0) {
        this.notificationWaiters.splice(index, 1);
      }
      waiter.resolve(notification);
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    for (const waiter of this.notificationWaiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  }
}
