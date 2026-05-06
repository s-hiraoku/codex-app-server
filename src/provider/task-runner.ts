import type { TaskMode } from "../policy/modes.js";

export type TaskRunResult = {
  provider: "codex";
  backend: "app-server";
  threadId: string;
  summary: string;
  changedFiles: string[];
};

export interface TaskRunner {
  runTask(params: {
    prompt: string;
    cwd: string;
    threadId?: string;
    mode: TaskMode;
  }): Promise<TaskRunResult>;
}
