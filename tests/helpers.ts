import { buildApp } from "../src/app.js";
import { openDatabase, type Db } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { createApiToken } from "../src/auth/token.js";
import type { AppConfig } from "../src/config.js";
import type { CodexRunner, CodexTaskResult } from "../src/codex/client.js";

export const TEST_CONFIG: AppConfig = {
  NODE_ENV: "test",
  PORT: 8787,
  HOST: "127.0.0.1",
  DATABASE_PATH: ":memory:",
  TOKEN_PEPPER: "test-pepper",
  BOOTSTRAP_ADMIN_TOKEN: "bootstrap-secret"
};

export class FakeCodexRunner implements CodexRunner {
  calls: Array<{ prompt: string; cwd: string; mode: string }> = [];
  summary = "task completed";
  changedFiles: string[] = [];

  async runTask(params: {
    prompt: string;
    cwd: string;
    threadId?: string;
    mode: "read-only" | "workspace-write";
  }): Promise<CodexTaskResult> {
    this.calls.push(params);
    return {
      threadId: "thr_test",
      summary: this.summary,
      changedFiles: this.changedFiles
    };
  }
}

export function makeTestDb(): Db {
  const db = openDatabase(":memory:");
  migrate(db);
  return db;
}

export function makeTestApp(options: { db?: Db; codexRunner?: CodexRunner } = {}) {
  const db = options.db ?? makeTestDb();
  const codexRunner = options.codexRunner ?? new FakeCodexRunner();
  const app = buildApp({
    config: TEST_CONFIG,
    db,
    codexRunner
  });

  return { app, db, codexRunner };
}

export function issueToken(
  db: Db,
  scopes: string[],
  options: { name?: string; expiresInDays?: number | null } = {}
) {
  return createApiToken(db, {
    name: options.name ?? "test-token",
    scopes,
    expiresInDays: options.expiresInDays ?? 30,
    pepper: TEST_CONFIG.TOKEN_PEPPER
  });
}

export function authHeader(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}
