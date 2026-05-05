import type { FastifyRequest } from "fastify";
import { ApiError } from "../utils/errors.js";
import { hasScope } from "./scopes.js";

export function requireScopes(request: FastifyRequest, scopes: string[]): void {
  const auth = request.auth;
  if (!auth) {
    throw new ApiError("UNAUTHORIZED");
  }

  const missing = scopes.find((scope) => !hasScope(auth.scopes, scope));
  if (missing) {
    throw new ApiError("FORBIDDEN");
  }
}

export function requireCanMintScopes(request: FastifyRequest, scopes: string[]): void {
  const auth = request.auth;
  if (!auth) {
    throw new ApiError("UNAUTHORIZED");
  }

  if (auth.isBootstrap) {
    return;
  }

  const missing = scopes.find((scope) => !hasScope(auth.scopes, scope));
  if (missing) {
    throw new ApiError("FORBIDDEN", "Cannot create a token with scopes you do not have");
  }
}

export function requireCanMintUntil(request: FastifyRequest, childExpiresAt: string): void {
  const auth = request.auth;
  if (!auth) {
    throw new ApiError("UNAUTHORIZED");
  }

  if (auth.isBootstrap) {
    return;
  }

  if (!auth.expiresAt || Date.parse(childExpiresAt) > Date.parse(auth.expiresAt)) {
    throw new ApiError("FORBIDDEN", "Cannot create a token that outlives its issuer");
  }
}
