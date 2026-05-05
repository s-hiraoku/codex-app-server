import type { FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/connection.js";
import { makeId, nowIso } from "../utils/ids.js";

function defaultAction(request: FastifyRequest): string {
  return `${request.method} ${request.routeOptions.url ?? request.url}`;
}

export function writeAuditLog(db: Db, request: FastifyRequest, reply: FastifyReply): void {
  const auth = request.auth;
  if (!auth) {
    return;
  }

  const audit = request.audit ?? {};
  const status = reply.statusCode >= 400 ? "failure" : "success";
  db.prepare(
    `INSERT INTO audit_logs (
      id, timestamp, token_id, token_name, client_ip, user_agent, action, repo, mode,
      task_id, status, error, prompt_hash, prompt_preview
    ) VALUES (
      @id, @timestamp, @tokenId, @tokenName, @clientIp, @userAgent, @action, @repo, @mode,
      @taskId, @status, @error, @promptHash, @promptPreview
    )`
  ).run({
    id: makeId("aud"),
    timestamp: nowIso(),
    tokenId: auth.id,
    tokenName: auth.name,
    clientIp: request.ip ?? null,
    userAgent: request.headers["user-agent"] ?? null,
    action: audit.action ?? defaultAction(request),
    repo: audit.repo ?? null,
    mode: audit.mode ?? null,
    taskId: audit.taskId ?? null,
    status,
    error: status === "failure" ? (audit.error ?? String(reply.statusCode)) : null,
    promptHash: audit.promptHash ?? null,
    promptPreview: audit.promptPreview ?? null
  });
}
