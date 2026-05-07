import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/connection.js";
import type { CodexRunner } from "../codex/client.js";
import { createTask, getTask } from "../codex/tasks.js";
import { authorizeTaskCreate, authorizeTaskRead } from "../policy/task-policy.js";
import { ApiError } from "../utils/errors.js";
import { hashPrompt } from "../auth/hash.js";
import { makeId } from "../utils/ids.js";
import { sanitizePublicText } from "../utils/sanitize.js";

const createTaskSchema = z.object({
  repo: z.string().min(1).max(100),
  prompt: z.string().min(1).max(20_000),
  mode: z.enum(["read-only", "workspace-write"]).optional()
}).strict();

function previewPrompt(prompt: string): string {
  return `[prompt omitted; length=${prompt.length}]`;
}

function taskResponse(task: NonNullable<ReturnType<typeof getTask>>) {
  return {
    taskId: task.id,
    status: task.status,
    repo: task.repo,
    mode: task.mode,
    summary: sanitizePublicText(task.summary),
    changedFiles: task.changedFiles,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    error: task.error
  };
}

export async function taskRoutes(app: FastifyInstance, deps: { db: Db; codexRunner: CodexRunner }) {
  app.post("/v1/tasks", async (request, reply) => {
    request.audit = { ...request.audit, action: "tasks:create" };

    const body = createTaskSchema.parse(request.body);
    const { repo, mode } = authorizeTaskCreate(request, body.repo, body.mode);
    request.audit = {
      ...request.audit,
      repo: repo.id,
      mode,
      promptHash: hashPrompt(body.prompt),
      promptPreview: previewPrompt(body.prompt)
    };

    if (!request.auth) {
      throw new ApiError("UNAUTHORIZED");
    }

    const taskId = makeId("task");
    request.audit = { ...request.audit, taskId };

    const task = createTask(deps.db, deps.codexRunner, {
      id: taskId,
      tokenId: request.auth.id,
      repoId: repo.id,
      cwd: repo.path,
      prompt: body.prompt,
      mode
    });
    return reply.status(202).send(taskResponse(task));
  });

  app.get("/v1/tasks/:id", async (request) => {
    request.audit = { ...request.audit, action: "tasks:read" };
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const task = getTask(deps.db, params.id);
    if (!task) {
      throw new ApiError("NOT_FOUND");
    }

    request.audit = { ...request.audit, repo: task.repo, mode: task.mode, taskId: task.id };
    authorizeTaskRead(request, task);

    return taskResponse(task);
  });
}
