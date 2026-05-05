import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashToken(token: string, pepper: string): string {
  return sha256(`${token}${pepper}`);
}

export function hashPrompt(prompt: string): string {
  return sha256(prompt);
}
