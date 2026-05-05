import type { FastifyInstance } from "fastify";
import { requireScopes } from "../auth/authorize.js";
import { listAllowedReposForScopes } from "../policy/repos.js";

export async function reposRoutes(app: FastifyInstance) {
  app.get("/v1/repos", async (request) => {
    request.audit = { ...request.audit, action: "repos:list" };
    requireScopes(request, ["task:read"]);

    return {
      repos: listAllowedReposForScopes(request.auth?.scopes ?? [])
    };
  });
}
