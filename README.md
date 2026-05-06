# codex-app-server

Personal Codex Gateway API Server for safely delegating work from external tools to local Codex workflows.

The gateway is the only HTTP API that should be exposed outside the machine. Codex App Server internals, repository paths, raw `cwd` values, and dangerous execution modes stay behind server-side policy.

OpenAI's Codex App Server WebSocket transport is documented as experimental and unsupported, and non-loopback WebSocket listeners require explicit auth before remote exposure. This project therefore runs App Server as a private internal process over stdio and exposes only this authenticated Gateway API.

## User Guide

The GitHub Pages-ready user guide lives in [`docs/index.md`](docs/index.md). Pages is deployed by `.github/workflows/pages.yml` whenever `main` changes the docs or the workflow.

## Development

Requirements:

- Node.js 24
- npm

Install dependencies:

```bash
npm install
```

Copy environment defaults:

```bash
cp .env.example .env
```

Set `CODEXGW_ALLOWED_REPOS_JSON` to the repos this gateway may operate on, and set a long random `TOKEN_PEPPER`. `BOOTSTRAP_ADMIN_TOKEN` is only for local bootstrap and is refused in production.
By default the gateway starts `codex app-server` using `CODEX_APP_SERVER_COMMAND=codex`.

Example repo allowlist:

```json
[
  {
    "id": "codex-app-server",
    "path": "/absolute/path/to/codex-app-server",
    "defaultMode": "read-only",
    "allowedModes": ["read-only", "workspace-write"]
  }
]
```

Run checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
scripts/verify.sh
```

Start the server:

```bash
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

## Bootstrap

Set `BOOTSTRAP_ADMIN_TOKEN` temporarily, start the server, and create a real admin token. Include the `token:*` scopes if this token will create, list, or revoke other tokens after bootstrap:

```bash
curl -X POST http://127.0.0.1:8787/v1/tokens \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin",
    "scopes": [
      "task:create",
      "task:read",
      "thread:create",
      "thread:write",
      "token:create",
      "token:read",
      "token:revoke",
      "codex:account:read",
      "codex:account:login",
      "codex:account:logout",
      "repo:codex-app-server",
      "mode:read-only",
      "mode:workspace-write"
    ],
    "expiresInDays": 90
  }'
```

The raw token is returned only once. Remove `BOOTSTRAP_ADMIN_TOKEN` from `.env` after bootstrap.

## API

Unauthenticated:

- `GET /healthz`

Authenticated:

- `GET /v1/repos` requires `task:read`; returns only repos covered by the caller's `repo:<repoId>` scopes.
- `POST /v1/tokens` requires `token:create`; tokens cannot mint scopes they do not already have, and child tokens cannot outlive their issuer.
- `GET /v1/tokens` requires `token:read`; never returns raw tokens or token hashes.
- `DELETE /v1/tokens/:id` requires `token:revoke`; revokes without physical deletion.
- `GET /v1/codex/account` requires `codex:account:read`; returns sanitized Codex account state.
- `POST /v1/codex/account/login/device-code` requires `codex:account:login`; starts ChatGPT device-code login and returns only `loginId`, `verificationUrl`, and `userCode`.
- `POST /v1/codex/account/login/cancel` requires `codex:account:login`; cancels a pending device-code login by `loginId`.
- `POST /v1/codex/account/logout` requires `codex:account:logout`; signs Codex out through App Server.
- `POST /v1/tasks` requires `task:create`, `repo:<repoId>`, and `mode:<mode>`.
- `GET /v1/tasks/:id` requires `task:read` and either task ownership or matching repo scope.

Task example:

```bash
curl -X POST http://127.0.0.1:8787/v1/tasks \
  -H "Authorization: Bearer $CODEXGW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "codex-app-server",
    "prompt": "READMEを読んで改善案を出してください",
    "mode": "read-only"
  }'
```

## Security

- No raw `cwd` API.
- Repositories resolve only through the server-side allowlist in `CODEXGW_ALLOWED_REPOS_JSON`; production startup refuses a missing allowlist.
- Default task mode is `read-only`.
- Public task modes are only `read-only` and `workspace-write`.
- Per-repo mode ceilings prevent sensitive repos from being made writeable by scope composition alone.
- `danger-full-access` is not accepted.
- No arbitrary shell execution endpoint exists.
- Tokens are stored as `sha256(token + TOKEN_PEPPER)`, never as plaintext.
- Authorization headers are redacted from logs.
- Prompt hashes are stored for audit; prompt previews are truncated and never store a short prompt in full.
- Responses and stored task output are scrubbed for common local absolute path patterns.
- Production config rejects the default pepper, rejects bootstrap admin token configuration, and requires an explicit repo allowlist.
- Codex App Server is called through an internal stdio JSON-RPC transport with fixed server-side options: allowlisted working directory, fixed sandbox policy, `approvalPolicy: "never"`, and no network access.
- Task runs use isolated App Server stdio connections so streamed turn events cannot cross between concurrent Gateway requests.
- The gateway does not expose a generic App Server JSON-RPC proxy, App Server filesystem APIs, command APIs, or `thread/shellCommand`.
- OpenAI API keys and ChatGPT access tokens are not accepted through public Gateway request bodies.
- Public task responses expose Gateway `taskId` only, not Codex thread IDs.

Prefer publishing through Tailscale, Cloudflare Tunnel, or another identity-aware private access layer. Opening a home Mac port directly to the internet is not recommended.

## Harness

This repository has a project-local copy of selected files from [`s-hiraoku/codex-harnesses`](https://github.com/s-hiraoku/codex-harnesses):

- `AGENTS.md`
- `policies/strict.yaml`
- `scripts/verify.sh`
- `scripts/checkpoint.sh`
- `codex/skills/`
- `codex/hooks/`
- `codex/ledger/`

The hook payloads are not automatically enforced. They are included so they can be reviewed, adapted, and wired into a supported Codex lifecycle configuration later.
