import { describe, expect, it } from "vitest";
import { authHeader, issueToken, makeTestApp } from "./helpers.js";

describe("policy", () => {
  it("rejects unregistered repos", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "not-allowed",
        prompt: "Summarize",
        mode: "read-only"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });

  it("does not accept raw cwd on task creation", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:codex-app-server", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        cwd: "/tmp/other",
        prompt: "Summarize",
        mode: "read-only"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("uses read-only as the default mode", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:codex-app-server", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        prompt: "Summarize"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().mode).toBe("read-only");
  });

  it("rejects danger-full-access", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:codex-app-server", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "codex-app-server",
        prompt: "Summarize",
        mode: "danger-full-access"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects workspace-write for read-only-only repos", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, [
      "task:create",
      "repo:operation-memory",
      "mode:read-only",
      "mode:workspace-write"
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "operation-memory",
        prompt: "Summarize",
        mode: "workspace-write"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("MODE_NOT_ALLOWED");
  });
});
