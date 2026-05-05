export type ApiTokenRecord = {
  id: string;
  name: string;
  prefix: string;
  tokenHash: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export type TaskRecord = {
  id: string;
  tokenId: string;
  repo: string;
  mode: string;
  threadId: string | null;
  status: "pending" | "completed" | "failed";
  summary: string;
  changedFiles: string[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AuditLogRecord = {
  id: string;
  timestamp: string;
  tokenId: string | null;
  tokenName: string | null;
  clientIp: string | null;
  userAgent: string | null;
  action: string;
  repo: string | null;
  mode: string | null;
  taskId: string | null;
  status: "success" | "failure";
  error: string | null;
  promptHash: string | null;
  promptPreview: string | null;
};
