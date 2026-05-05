import { ApiError } from "../utils/errors.js";

export const TASK_MODES = ["read-only", "workspace-write"] as const;

export type TaskMode = (typeof TASK_MODES)[number];

export function isTaskMode(value: string): value is TaskMode {
  return TASK_MODES.includes(value as TaskMode);
}

export function assertTaskMode(value: string): TaskMode {
  if (!isTaskMode(value)) {
    throw new ApiError("MODE_NOT_ALLOWED");
  }
  return value;
}
