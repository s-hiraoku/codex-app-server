import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/connection.js";
import { markTokenUsed, findTokenByRawValue } from "./token.js";
import { allBootstrapScopes } from "./scopes.js";
import { ApiError } from "../utils/errors.js";

export type AuthContext = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  isBootstrap: boolean;
};

export type AuditContext = {
  action?: string;
  repo?: string | null;
  mode?: string | null;
  taskId?: string | null;
  promptHash?: string | null;
  promptPreview?: string | null;
  error?: string | null;
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
    audit?: AuditContext;
  }
}

export function authMiddleware(db: Db, config: AppConfig) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new ApiError("UNAUTHORIZED");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new ApiError("UNAUTHORIZED");
    }

    if (config.BOOTSTRAP_ADMIN_TOKEN && token === config.BOOTSTRAP_ADMIN_TOKEN) {
      request.auth = {
        id: "bootstrap",
        name: "bootstrap",
        prefix: "bootstrap",
        scopes: allBootstrapScopes(),
        expiresAt: null,
        isBootstrap: true
      };
      return;
    }

    if (!token.startsWith("codexgw_live_")) {
      throw new ApiError("UNAUTHORIZED");
    }

    const record = findTokenByRawValue(db, token, config.TOKEN_PEPPER);
    if (!record) {
      throw new ApiError("UNAUTHORIZED");
    }

    if (record.revokedAt) {
      throw new ApiError("TOKEN_REVOKED");
    }

    if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
      throw new ApiError("TOKEN_EXPIRED");
    }

    markTokenUsed(db, record.id);
    request.auth = {
      id: record.id,
      name: record.name,
      prefix: record.prefix,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      isBootstrap: false
    };
  };
}
