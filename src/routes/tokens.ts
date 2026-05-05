import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/connection.js";
import { requireCanMintScopes, requireCanMintUntil, requireScopes } from "../auth/authorize.js";
import { createApiToken, listTokens, revokeToken } from "../auth/token.js";
import { ApiError } from "../utils/errors.js";

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1).max(100),
  expiresInDays: z.number().int().positive().max(366)
}).strict();

export async function tokenRoutes(app: FastifyInstance, deps: { db: Db; config: AppConfig }) {
  app.post("/v1/tokens", async (request) => {
    request.audit = { ...request.audit, action: "tokens:create" };
    requireScopes(request, ["token:create"]);

    const body = createTokenSchema.parse(request.body);
    requireCanMintScopes(request, body.scopes);
    const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    requireCanMintUntil(request, expiresAt);

    const token = createApiToken(deps.db, {
      name: body.name,
      scopes: body.scopes,
      expiresInDays: body.expiresInDays,
      pepper: deps.config.TOKEN_PEPPER
    });

    return {
      id: token.id,
      name: token.name,
      token: token.token,
      prefix: token.prefix,
      scopes: token.scopes,
      expiresAt: token.expiresAt
    };
  });

  app.get("/v1/tokens", async (request) => {
    request.audit = { ...request.audit, action: "tokens:list" };
    requireScopes(request, ["token:read"]);

    return {
      tokens: listTokens(deps.db)
    };
  });

  app.delete("/v1/tokens/:id", async (request) => {
    request.audit = { ...request.audit, action: "tokens:revoke" };
    requireScopes(request, ["token:revoke"]);

    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const revoked = revokeToken(deps.db, params.id);
    if (!revoked) {
      throw new ApiError("NOT_FOUND");
    }

    return {
      id: params.id,
      revoked: true
    };
  });
}
