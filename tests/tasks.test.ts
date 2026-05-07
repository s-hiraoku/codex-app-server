import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { authHeader, FakeCodexRunner, issueToken, makeTestApp } from "./helpers.js";

async function waitForTask(app: FastifyInstance, token: string, taskId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/v1/tasks/${taskId}`,
      headers: authHeader(token)
    });
    const body = response.json();
    if (body.status !== "pending") {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for task completion");
}

describe("tasks", () => {
  it("accepts a read-only task and completes it in the background", async () => {
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

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      status: "pending",
      repo: "codex-app-server",
      mode: "read-only"
    });
    expect(response.json().threadId).toBeUndefined();
    expect(runner.calls[0]?.mode).toBe("read-only");

    const task = await waitForTask(app, token.token, response.json().taskId as string);
    expect(task).toMatchObject({
      status: "completed",
      summary: "task completed",
      changedFiles: []
    });
  });

  it("rejects workspace-write when token lacks workspace-write scope", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "task:read", "repo:codex-app-server", "mode:read-only"]);

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
    const token = issueToken(db, ["task:create", "task:read", "repo:codex-app-server", "mode:read-only"]);
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

    expect(response.statusCode).toBe(202);
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
      "Read /Users/name/project/README.md, /home/runner/work/repo/file.ts, /workspace/app/secret, C:\\Users\\name\\secret.txt, \\\\server\\share\\secret.txt, and /tmp/project/secret";
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

    expect(response.statusCode).toBe(202);
    const task = await waitForTask(app, token.token, response.json().taskId as string);
    expect(JSON.stringify(task)).not.toContain("/Users/name");
    expect(JSON.stringify(task)).not.toContain("/home/runner");
    expect(JSON.stringify(task)).not.toContain("/workspace/app");
    expect(JSON.stringify(task)).not.toContain("C:\\Users");
    expect(JSON.stringify(task)).not.toContain("\\\\server\\share");
    expect(JSON.stringify(task)).not.toContain("/tmp/project");
    expect(JSON.stringify(task)).toContain("[redacted-path]");
  });

  it("marks background task failures without leaking runner details through create", async () => {
    const runner = new FakeCodexRunner();
    runner.error = new Error("failed at /Users/name/project/secret.txt");
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

    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe("pending");

    const task = await waitForTask(app, token.token, response.json().taskId as string);
    expect(task.status).toBe("failed");
    expect(task.error).toContain("[redacted-path]");
    expect(task.error).not.toContain("/Users/name");
  });
});
