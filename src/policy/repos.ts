import { ApiError } from "../utils/errors.js";
import type { TaskMode } from "./modes.js";

export type AllowedRepo = {
  id: string;
  path: string;
  defaultMode: TaskMode;
  allowedModes: readonly TaskMode[];
};

export const ALLOWED_REPOS = {
  "operation-memory": {
    id: "operation-memory",
    path: "/Volumes/SSD/ghq/github.com/s-hiraoku/operation-memory",
    defaultMode: "read-only",
    allowedModes: ["read-only"]
  },
  "codex-harnesses": {
    id: "codex-harnesses",
    path: "/Volumes/SSD/ghq/github.com/s-hiraoku/codex-harnesses",
    defaultMode: "read-only",
    allowedModes: ["read-only", "workspace-write"]
  },
  "codex-app-server": {
    id: "codex-app-server",
    path: "/Volumes/SSD/ghq/github.com/s-hiraoku/codex-app-server",
    defaultMode: "read-only",
    allowedModes: ["read-only", "workspace-write"]
  }
} as const satisfies Record<string, AllowedRepo>;

export type RepoId = keyof typeof ALLOWED_REPOS;

export function getAllowedRepo(repoId: string): AllowedRepo {
  const repo = ALLOWED_REPOS[repoId as RepoId];
  if (!repo) {
    throw new ApiError("REPO_NOT_ALLOWED");
  }
  return repo;
}

export function listAllowedRepos(): Array<Pick<AllowedRepo, "id" | "defaultMode">> {
  return Object.values(ALLOWED_REPOS).map((repo) => ({
    id: repo.id,
    defaultMode: repo.defaultMode
  }));
}

export function listAllowedReposForScopes(scopes: readonly string[]): Array<Pick<AllowedRepo, "id" | "defaultMode">> {
  return Object.values(ALLOWED_REPOS)
    .filter((repo) => scopes.includes(`repo:${repo.id}`))
    .map((repo) => ({
      id: repo.id,
      defaultMode: repo.defaultMode
    }));
}

export function allowedRepoIds(): string[] {
  return Object.keys(ALLOWED_REPOS);
}
