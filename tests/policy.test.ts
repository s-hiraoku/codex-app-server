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
    const token = issueToken(db, ["task:create", "repo:local-agent-gateway", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "local-agent-gateway",
        cwd: "/tmp/other",
        prompt: "Summarize",
        mode: "read-only"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("does not accept workspace target fields before registry support exists", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:local-agent-gateway", "mode:read-only"]);

    const workspaceIdResponse = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "local-agent-gateway",
        workspaceId: "ws_test",
        prompt: "Summarize",
        mode: "read-only"
      }
    });

    const workspacePathResponse = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "local-agent-gateway",
        workspacePath: "/tmp/other",
        prompt: "Summarize",
        mode: "read-only"
      }
    });

    expect(workspaceIdResponse.statusCode).toBe(400);
    expect(workspaceIdResponse.json().error.code).toBe("VALIDATION_ERROR");
    expect(workspacePathResponse.statusCode).toBe(400);
    expect(workspacePathResponse.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("does not expose workspace registry endpoints before target policy exists", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:read", "repo:local-agent-gateway"]);

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/workspaces",
      headers: authHeader(token.token)
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: authHeader(token.token),
      payload: {
        path: "/tmp/other",
        repo: "local-agent-gateway"
      }
    });

    expect(listResponse.statusCode).toBe(404);
    expect(createResponse.statusCode).toBe(404);
  });

  it("uses read-only as the default mode", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:local-agent-gateway", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "local-agent-gateway",
        prompt: "Summarize"
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().mode).toBe("read-only");
  });

  it("rejects danger-full-access", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["task:create", "repo:local-agent-gateway", "mode:read-only"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "local-agent-gateway",
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
      "repo:readonly-example",
      "mode:read-only",
      "mode:workspace-write"
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      headers: authHeader(token.token),
      payload: {
        repo: "readonly-example",
        prompt: "Summarize",
        mode: "workspace-write"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("MODE_NOT_ALLOWED");
  });
});
