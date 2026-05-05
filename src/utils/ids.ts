import { randomBytes, randomUUID } from "node:crypto";

export function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function makeToken(): string {
  return `codexgw_live_${randomBytes(32).toString("base64url")}`;
}

export function tokenPrefix(token: string): string {
  const marker = "codexgw_live_";
  if (!token.startsWith(marker)) {
    return token.slice(0, 18);
  }
  return `${marker}${token.slice(marker.length, marker.length + 4)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
