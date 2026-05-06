# Verification Log

Use this file to record meaningful verification runs.

## Template

### YYYY-MM-DD HH:MM

- Command:
- Scope:
- Result:
- Notes:

## Runs

### 2026-05-05 11:11

- Command: `npm run typecheck`
- Scope: TypeScript project
- Result: Passed
- Notes: Initial development foundation.

### 2026-05-05 11:11

- Command: `npm test`
- Scope: Vitest health route test
- Result: Passed
- Notes: Initial run passed.

### 2026-05-05 11:11

- Command: `npm run lint`
- Scope: ESLint project
- Result: Passed
- Notes: Initial run passed.

### 2026-05-05 11:11

- Command: `npm run build`
- Scope: TypeScript emit
- Result: Passed
- Notes: Initial run passed; build script was then narrowed to `tsconfig.build.json` so tests are not emitted.

### 2026-05-05 11:11

- Command: `scripts/verify.sh`
- Scope: Harness verification entrypoint
- Result: Passed
- Notes: Ran lint, typecheck, test, and build.

### 2026-05-05 11:12

- Command: `scripts/verify.sh`
- Scope: Harness verification entrypoint after config cleanup
- Result: Passed
- Notes: Confirmed Vitest excludes generated `dist/**` tests and build uses `tsconfig.build.json`.

### 2026-05-05 11:12

- Command: `npm run dev` and `curl -sS http://127.0.0.1:8787/healthz`
- Scope: Local development server smoke test
- Result: Passed
- Notes: Server returned `{"ok":true}`. Dev process was stopped after the smoke test.

### 2026-05-05 11:17

- Command: `bash -n scripts/checkpoint.sh && bash -n scripts/verify.sh`
- Scope: Repository-managed harness scripts
- Result: Passed
- Notes: Confirmed shell syntax for both harness scripts.

### 2026-05-05 11:17

- Command: `scripts/verify.sh`
- Scope: Repository-managed harness verification
- Result: Passed
- Notes: Ran lint, typecheck, test, and build after adding `codex/README.md` and `scripts/checkpoint.sh`.

### 2026-05-05 11:34

- Command: `scripts/verify.sh`
- Scope: Secure Gateway MVP
- Result: Passed
- Notes: Ran lint, typecheck, 26 Vitest tests, and build after final security-review fixes.

### 2026-05-05 11:35

- Command: `npm run dev` and `curl -sS http://127.0.0.1:8787/healthz`
- Scope: Local development server smoke test
- Result: Passed
- Notes: Server returned `{"ok":true}`. Dev process was stopped after the smoke test.

### 2026-05-05 11:41

- Command: `scripts/verify.sh`
- Scope: Node 24 runtime requirement update
- Result: Passed
- Notes: Ran lint, typecheck, 26 Vitest tests, and build with local Node `v24.12.0`.

### 2026-05-06 11:00

- Command: `scripts/verify.sh`
- Scope: Codex App Server backend migration and account auth routes
- Result: Passed
- Notes: Ran lint, typecheck, 34 Vitest tests, and build after adding stdio JSON-RPC App Server adapter, scoped account routes, and provider/backend task metadata.

### 2026-05-06 11:10

- Command: `./node_modules/.bin/codex app-server generate-ts --out /private/tmp/codex-app-server-schema`
- Scope: Local Codex App Server protocol schema check
- Result: Passed
- Notes: Confirmed app-server protocol generation works for local `codex-cli 0.128.0`; adjusted sandbox and params wire shapes to generated schema.

### 2026-05-06 11:10

- Command: `node --input-type=module -e '<app-server initialize/account-read smoke test>'`
- Scope: Real local Codex App Server stdio smoke test
- Result: Passed
- Notes: Spawned local app-server, completed `initialize`/`initialized`, and verified `account/read` returns an object without printing account details.

### 2026-05-06 11:11

- Command: `node --input-type=module -e '<app-server thread/turn smoke test>'`
- Scope: Real local Codex App Server turn execution smoke test
- Result: Passed
- Notes: First sandboxed attempt could not access `~/.codex/sessions`; reran outside the sandbox with approval, then completed `thread/start`, `turn/start`, and `turn/completed` with read-only sandbox policy.

### 2026-05-06 11:10

- Command: `scripts/verify.sh`
- Scope: App Server schema alignment and per-task connection update
- Result: Passed
- Notes: Ran lint, typecheck, 34 Vitest tests, and build after changing task runs to isolated App Server stdio connections.

### 2026-05-06 11:41

- Command: `scripts/verify.sh`
- Scope: PR #3 rebase onto updated `origin/main`
- Result: Passed
- Notes: Ran lint, typecheck, 34 Vitest tests, and build after resolving README conflict and preserving user guide plus token/account bootstrap scopes.

### 2026-05-06 11:42

- Command: `scripts/verify.sh`
- Scope: PR #3 guardian feedback fix
- Result: Passed
- Notes: Ran lint, typecheck, 35 Vitest tests, and build after adding immediate JSON-RPC error responses for unsupported app-server initiated requests.

### 2026-05-06 11:48

- Command: `scripts/verify.sh`
- Scope: Documentation coverage for Codex App Server account/backend behavior
- Result: Passed
- Notes: Ran lint, typecheck, 35 Vitest tests, and build after updating `docs/index.md` to cover internal App Server transport, account auth endpoints/scopes, and new backend configuration.
