const ABSOLUTE_PATH_PATTERNS = [
  /\\\\[^\s\\/"'`<>]+\\[^\s"'`<>]+/g,
  /\b[A-Za-z]:[\\/][^\s"'`<>]+/g,
  /(?<![:\w])\/(?:Volumes|Users|home|workspace|workspaces|private|tmp|var|opt|srv|mnt|media|root|app|repo|project|builds|runner|github)\/[^\s"'`<>]+/g
];

export function sanitizePublicText(text: string): string {
  let sanitized = text;
  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted-path]");
  }
  return sanitized;
}
