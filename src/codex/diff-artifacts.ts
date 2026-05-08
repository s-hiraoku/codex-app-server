import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TaskRecord } from "../db/schema.js";
import { getAllowedRepo } from "../policy/repos.js";
import { ApiError } from "../utils/errors.js";
import { sanitizePublicText } from "../utils/sanitize.js";

const execFileAsync = promisify(execFile);
const MAX_DIFF_BYTES = 256 * 1024;
const GIT_DIFF_MAX_BUFFER_BYTES = 2 * 1024 * 1024;

export type TaskDiffArtifact = {
  taskId: string;
  repo: string;
  status: TaskRecord["status"];
  changedFiles: string[];
  patch: string;
  truncated: boolean;
};

export async function getTaskDiffArtifact(task: TaskRecord): Promise<TaskDiffArtifact> {
  const repo = getAllowedRepo(task.repo);
  const changedFiles = safeChangedFiles(task.changedFiles);

  if (changedFiles.length === 0) {
    return {
      taskId: task.id,
      repo: task.repo,
      status: task.status,
      changedFiles,
      patch: "",
      truncated: false
    };
  }

  let stdout: string;
  try {
    const result = await execFileAsync(
      "git",
      ["-C", repo.path, "diff", "--no-ext-diff", "--", ...changedFiles],
      {
        encoding: "utf8",
        maxBuffer: GIT_DIFF_MAX_BUFFER_BYTES
      }
    );
    stdout = result.stdout;
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Diff artifact is unavailable");
  }
  const truncated = Buffer.byteLength(stdout, "utf8") > MAX_DIFF_BYTES;
  const patch = truncated ? stdout.slice(0, MAX_DIFF_BYTES) : stdout;

  return {
    taskId: task.id,
    repo: task.repo,
    status: task.status,
    changedFiles,
    patch: sanitizePublicText(patch),
    truncated
  };
}

function safeChangedFiles(files: readonly string[]): string[] {
  return files.filter(isSafeRepoRelativePath);
}

function isSafeRepoRelativePath(file: string): boolean {
  if (!file || file.includes("\0") || file.startsWith("/") || file.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(file)) {
    return false;
  }

  const parts = file.split(/[\\/]+/);
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}
