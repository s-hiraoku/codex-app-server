# codex-app-server

Personal Codex Gateway API Server for safely delegating work from external tools to local Codex workflows.

The gateway is the only HTTP API that should be exposed outside the machine. Codex App Server, Codex SDK internals, repository paths, raw `cwd` values, and dangerous execution modes stay behind server-side policy.

OpenAI's Codex App Server WebSocket transport is documented as experimental and unsupported, and non-loopback WebSocket listeners require explicit auth before remote exposure. This project therefore keeps App Server private and exposes only this authenticated Gateway API.

## User Guide

The GitHub Pages-ready user guide lives in [`docs/index.md`](docs/index.md). Configure GitHub Pages to deploy from the `/docs` folder to publish it.

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

Set a long random `TOKEN_PEPPER`. `BOOTSTRAP_ADMIN_TOKEN` is only for local bootstrap and is refused in production.

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

Set `BOOTSTRAP_ADMIN_TOKEN` temporarily, start the server, and create a real admin or app token:

```bash
curl -X POST http://127.0.0.1:8787/v1/tokens \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "raycast",
    "scopes": [
      "task:create",
      "task:read",
      "thread:create",
      "thread:write",
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
- Repositories resolve only through the server-side allowlist in `src/policy/repos.ts`.
- Default task mode is `read-only`.
- Public task modes are only `read-only` and `workspace-write`.
- Per-repo mode ceilings prevent sensitive repos from being made writeable by scope composition alone.
- `danger-full-access` is not accepted.
- No arbitrary shell execution endpoint exists.
- Tokens are stored as `sha256(token + TOKEN_PEPPER)`, never as plaintext.
- Authorization headers are redacted from logs.
- Prompt hashes are stored for audit; prompt previews are truncated and never store a short prompt in full.
- Responses and stored task output are scrubbed for common local absolute path patterns.
- Production config rejects the default pepper and rejects bootstrap admin token configuration.
- Codex SDK is called with fixed server-side options: allowlisted working directory, fixed sandbox mode, `approvalPolicy: "never"`, no network access, and web search disabled.
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
