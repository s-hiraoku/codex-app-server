import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireScopes } from "../auth/authorize.js";
import type { CodexAccountClient } from "../codex/app-server-client.js";

const cancelLoginSchema = z.object({
  loginId: z.string().min(1)
}).strict();

export async function codexAccountRoutes(app: FastifyInstance, deps: { codex: CodexAccountClient }) {
  app.get("/v1/codex/account", async (request) => {
    request.audit = { ...request.audit, action: "codex:account:read" };
    requireScopes(request, ["codex:account:read"]);
    return deps.codex.getAccount();
  });

  app.post("/v1/codex/account/login/device-code", async (request) => {
    request.audit = { ...request.audit, action: "codex:account:login:device-code" };
    requireScopes(request, ["codex:account:login"]);
    return deps.codex.startDeviceCodeLogin();
  });

  app.post("/v1/codex/account/login/cancel", async (request) => {
    request.audit = { ...request.audit, action: "codex:account:login:cancel" };
    requireScopes(request, ["codex:account:login"]);
    const body = cancelLoginSchema.parse(request.body);
    await deps.codex.cancelLogin(body.loginId);
    return { cancelled: true };
  });

  app.post("/v1/codex/account/logout", async (request) => {
    request.audit = { ...request.audit, action: "codex:account:logout" };
    requireScopes(request, ["codex:account:logout"]);
    await deps.codex.logout();
    return { loggedOut: true };
  });
}
