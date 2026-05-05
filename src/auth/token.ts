import type { Db } from "../db/connection.js";
import type { ApiTokenRecord } from "../db/schema.js";
import { hashToken } from "./hash.js";
import { isValidScope } from "./scopes.js";
import { ApiError } from "../utils/errors.js";
import { makeId, makeToken, nowIso, tokenPrefix } from "../utils/ids.js";

type ApiTokenRow = {
  id: string;
  name: string;
  prefix: string;
  token_hash: string;
  scopes_json: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
};

export type CreatedToken = Omit<ApiTokenRecord, "tokenHash" | "revokedAt" | "lastUsedAt"> & {
  token: string;
  revokedAt: null;
  lastUsedAt: null;
};

export function parseTokenRow(row: ApiTokenRow): ApiTokenRecord {
  const scopes = JSON.parse(row.scopes_json) as unknown;
  if (!Array.isArray(scopes) || !scopes.every((scope) => typeof scope === "string")) {
    throw new ApiError("INTERNAL_ERROR");
  }

  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    tokenHash: row.token_hash,
    scopes,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at
  };
}

export function assertValidScopes(scopes: string[]): void {
  if (scopes.length === 0 || scopes.some((scope) => !isValidScope(scope))) {
    throw new ApiError("VALIDATION_ERROR", "Invalid scopes");
  }
}

export function createApiToken(
  db: Db,
  params: {
    name: string;
    scopes: string[];
    expiresInDays?: number | null;
    pepper: string;
  }
): CreatedToken {
  assertValidScopes(params.scopes);

  const token = makeToken();
  const createdAt = nowIso();
  const expiresAt =
    params.expiresInDays == null
      ? null
      : new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const record = {
    id: makeId("tok"),
    name: params.name,
    prefix: tokenPrefix(token),
    tokenHash: hashToken(token, params.pepper),
    scopes: params.scopes,
    createdAt,
    expiresAt,
    revokedAt: null,
    lastUsedAt: null
  };

  db.prepare(
    `INSERT INTO api_tokens (
      id, name, prefix, token_hash, scopes_json, created_at, expires_at, revoked_at, last_used_at
    ) VALUES (
      @id, @name, @prefix, @tokenHash, @scopesJson, @createdAt, @expiresAt, NULL, NULL
    )`
  ).run({
    ...record,
    scopesJson: JSON.stringify(record.scopes)
  });

  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    scopes: record.scopes,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    revokedAt: null,
    lastUsedAt: null,
    token
  };
}

export function findTokenByRawValue(db: Db, token: string, pepper: string): ApiTokenRecord | null {
  const row = db
    .prepare("SELECT * FROM api_tokens WHERE token_hash = ?")
    .get(hashToken(token, pepper)) as ApiTokenRow | undefined;

  return row ? parseTokenRow(row) : null;
}

export function listTokens(db: Db): Array<Omit<ApiTokenRecord, "tokenHash">> {
  const rows = db.prepare("SELECT * FROM api_tokens ORDER BY created_at DESC").all() as ApiTokenRow[];
  return rows.map((row) => {
    const { tokenHash: _tokenHash, ...record } = parseTokenRow(row);
    return record;
  });
}

export function revokeToken(db: Db, id: string): boolean {
  const result = db.prepare("UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(nowIso(), id);
  return result.changes > 0;
}

export function markTokenUsed(db: Db, id: string): void {
  db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(nowIso(), id);
}
