import { describe, expect, it } from "vitest";
import type { ApiError } from "../src/utils/errors.js";
import { CodexClient } from "../src/codex/client.js";
import { authHeader, FakeCodexRunner, issueToken, makeTestApp } from "./helpers.js";

describe("tasks", () => {
  it("creates a read-only task", async () => {
    const runner = new FakeCodexRunner();
    const { app, db } = makeTestApp({ codexRunner: runner });
    const token = issueToken(db, ["task:create", "task:read", "repo:codex-app-server", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        prompt: "Read README",
        mode: "read-only"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "completed",
      repo: "codex-app-server",
      mode: "read-only",
      summary: "task completed",
      changedFiles: []
    });
    expect(response.json().threadId).toBeUndefined();
    expect(runner.calls[0]?.mode).toBe("read-only");
  });

  it("rejects workspace-write when token lacks workspace-write scope", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:codex-app-server", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        prompt: "Change README",
        mode: "workspace-write"
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("creates an audit log for task creation without storing full prompt", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:codex-app-server", "mode:read-only"]);
    const prompt = "A".repeat(250);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        prompt,
        mode: "read-only"
      }
    });

    expect(response.statusCode).toBe(200);
    const row = db.prepare("SELECT * FROM audit_logs WHERE action = 'tasks:create'").get() as {
      repo: string;
      mode: string;
      status: string;
      prompt_hash: string;
      prompt_preview: string;
    };

    expect(row.repo).toBe("codex-app-server");
    expect(row.mode).toBe("read-only");
    expect(row.status).toBe("success");
    expect(row.prompt_hash).toHaveLength(64);
    expect(row.prompt_preview).toBe(`[prompt omitted; length=${prompt.length}]`);
    expect(row.prompt_preview).not.toBe(prompt);
  });

  it("does not include local absolute paths in task responses", async () => {
    const runner = new FakeCodexRunner();
    runner.summary =
      "Read /Volumes/SSD/ghq/github.com/s-hiraoku/codex-app-server/README.md, /home/runner/work/repo/file.ts, /workspace/app/secret, C:\\Users\\name\\secret.txt, \\\\server\\share\\secret.txt, and /Users/name/secret";
    const { app, db } = makeTestApp({ codexRunner: runner });
    const token = issueToken(db, ["task:create", "repo:codex-app-server", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        prompt: "Read README",
        mode: "read-only"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("/Volumes/SSD");
    expect(response.body).not.toContain("/home/runner");
    expect(response.body).not.toContain("/workspace/app");
    expect(response.body).not.toContain("C:\\Users");
    expect(response.body).not.toContain("\\\\server\\share");
    expect(response.body).not.toContain("/Users/");
    expect(response.body).toContain("[redacted-path]");
  });

  it("classifies Codex runtime failures separately from configuration failures", async () => {
    const codex = {
      startThread: () => ({
        id: "thr_test",
        run: async () => {
          throw new Error("sandbox process exited");
        }
      })
    };
    const client = new CodexClient(codex as never);

    await expect(
      client.runTask({
        prompt: "Run",
        cwd: process.cwd(),
        mode: "read-only"
      })
    ).rejects.toMatchObject({
      code: "CODEX_EXECUTION_FAILED",
      statusCode: 500
    } satisfies Partial<ApiError>);
  });

  it("keeps Codex configuration failures as not configured", async () => {
    const codex = {
      startThread: () => {
        throw new Error("Authentication credentials are not configured");
      }
    };
    const client = new CodexClient(codex as never);

    await expect(
      client.runTask({
        prompt: "Run",
        cwd: process.cwd(),
        mode: "read-only"
      })
    ).rejects.toMatchObject({
      code: "CODEX_NOT_CONFIGURED",
      statusCode: 501
    } satisfies Partial<ApiError>);
  });
});
