import { Codex, type CodexOptions, type FileChangeItem, type SandboxMode, type ThreadOptions } from "@openai/codex-sdk";
import { relative, resolve, sep } from "node:path";
import { ApiError } from "../utils/errors.js";
import type { TaskMode } from "../policy/modes.js";
import { sanitizePublicText } from "../utils/sanitize.js";

export type CodexTaskResult = {
  threadId: string;
  summary: string;
  changedFiles: string[];
};

export interface CodexRunner {
  runTask(params: {
    prompt: string;
    cwd: string;
    threadId?: string;
    mode: TaskMode;
  }): Promise<CodexTaskResult>;
}

function assertInsideRepo(path: string, repoRoot: string): string | null {
  const resolvedRoot = resolve(repoRoot);
  const resolvedPath = resolve(repoRoot, path);
  const relativePath = relative(resolvedRoot, resolvedPath);

  if (relativePath === "" || relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    return null;
  }

  return relativePath;
}

function extractChangedFiles(items: unknown[], repoRoot: string): string[] {
  const paths = new Set<string>();

  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const maybeItem = item as Partial<FileChangeItem>;
    if (maybeItem.type !== "file_change" || maybeItem.status !== "completed" || !Array.isArray(maybeItem.changes)) {
      continue;
    }

    for (const change of maybeItem.changes) {
      if (!change || typeof change.path !== "string") {
        continue;
      }
      const safePath = assertInsideRepo(change.path, repoRoot);
      if (safePath) {
        paths.add(safePath);
      }
    }
  }

  return [...paths].sort();
}

export class CodexClient implements CodexRunner {
  private readonly codex: Codex;

  constructor(codex = new Codex(defaultCodexOptions())) {
    this.codex = codex;
  }

  async runTask(params: {
    prompt: string;
    cwd: string;
    threadId?: string;
    mode: TaskMode;
  }): Promise<CodexTaskResult> {
    const threadOptions: ThreadOptions = {
      workingDirectory: params.cwd,
      sandboxMode: params.mode as SandboxMode,
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
      skipGitRepoCheck: false
    };

    try {
      const thread = params.threadId
        ? this.codex.resumeThread(params.threadId, threadOptions)
        : this.codex.startThread(threadOptions);
      const turn = await thread.run(params.prompt);

      return {
        threadId: thread.id ?? "",
        summary: sanitizePublicText(turn.finalResponse),
        changedFiles: extractChangedFiles(turn.items, params.cwd)
      };
    } catch {
      throw new ApiError("CODEX_NOT_CONFIGURED", "Codex task execution is not available");
    }
  }
}

function defaultCodexOptions(): CodexOptions {
  return {
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp"
    }
  };
}
