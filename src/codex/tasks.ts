import type { Db } from "../db/connection.js";
import type { TaskRecord } from "../db/schema.js";
import type { CodexRunner } from "./client.js";
import type { TaskMode } from "../policy/modes.js";
import { makeId, nowIso } from "../utils/ids.js";
import { sanitizePublicText } from "../utils/sanitize.js";

type TaskRow = {
  id: string;
  token_id: string;
  provider: string;
  backend: string;
  repo: string;
  mode: string;
  thread_id: string | null;
  status: "pending" | "completed" | "failed";
  summary: string;
  changed_files_json: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export function parseTaskRow(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    tokenId: row.token_id,
    provider: row.provider,
    backend: row.backend,
    repo: row.repo,
    mode: row.mode,
    threadId: row.thread_id,
    status: row.status,
    summary: row.summary,
    changedFiles: JSON.parse(row.changed_files_json) as string[],
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

export async function createTask(
  db: Db,
  runner: CodexRunner,
  params: {
    tokenId: string;
    repoId: string;
    cwd: string;
    prompt: string;
    mode: TaskMode;
    id?: string;
  }
): Promise<TaskRecord> {
  const id = params.id ?? makeId("task");
  const createdAt = nowIso();

  db.prepare(
    `INSERT INTO tasks (
      id, token_id, provider, backend, repo, mode, thread_id, status, summary, changed_files_json, error, created_at, completed_at
    ) VALUES (
      @id, @tokenId, 'codex', 'app-server', @repo, @mode, NULL, 'pending', '', '[]', NULL, @createdAt, NULL
    )`
  ).run({
    id,
    tokenId: params.tokenId,
    repo: params.repoId,
    mode: params.mode,
    createdAt
  });

  try {
    const result = await runner.runTask({
      prompt: params.prompt,
      cwd: params.cwd,
      mode: params.mode
    });
    const completedAt = nowIso();

    db.prepare(
      `UPDATE tasks
       SET thread_id = @threadId,
           provider = @provider,
           backend = @backend,
           status = 'completed',
           summary = @summary,
           changed_files_json = @changedFilesJson,
           completed_at = @completedAt
       WHERE id = @id`
    ).run({
      id,
      threadId: result.threadId,
      provider: result.provider,
      backend: result.backend,
      summary: sanitizePublicText(result.summary),
      changedFilesJson: JSON.stringify(result.changedFiles),
      completedAt
    });
  } catch (error) {
    const completedAt = nowIso();
    db.prepare(
      `UPDATE tasks
       SET status = 'failed',
           error = @error,
           completed_at = @completedAt
       WHERE id = @id`
    ).run({
      id,
      error: error instanceof Error ? sanitizePublicText(error.message) : "Task failed",
      completedAt
    });
    throw error;
  }

  return getTask(db, id) as TaskRecord;
}

export function getTask(db: Db, id: string): TaskRecord | null {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row ? parseTaskRow(row) : null;
}
