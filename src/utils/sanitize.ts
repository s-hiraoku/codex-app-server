const ABSOLUTE_PATH_PATTERNS = [
  /\/Volumes\/[^\s"'`<>]+/g,
  /\/Users\/[^\s"'`<>]+/g,
  /\/private\/[^\s"'`<>]+/g,
  /\/tmp\/[^\s"'`<>]+/g
];

export function sanitizePublicText(text: string): string {
  let sanitized = text;
  for (const pattern of ABSOLUTE_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted-path]");
  }
  return sanitized;
}
