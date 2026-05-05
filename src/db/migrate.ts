import type { Db } from "./connection.js";

export function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      scopes_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      revoked_at TEXT,
      last_used_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash
      ON api_tokens(token_hash);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      repo TEXT NOT NULL,
      mode TEXT NOT NULL,
      thread_id TEXT,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      changed_files_json TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_token_id
      ON tasks(token_id);

    CREATE INDEX IF NOT EXISTS idx_tasks_repo
      ON tasks(repo);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      token_id TEXT,
      token_name TEXT,
      client_ip TEXT,
      user_agent TEXT,
      action TEXT NOT NULL,
      repo TEXT,
      mode TEXT,
      task_id TEXT,
      status TEXT NOT NULL,
      error TEXT,
      prompt_hash TEXT,
      prompt_preview TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_token_id
      ON audit_logs(token_id);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id
      ON audit_logs(task_id);
  `);
}
