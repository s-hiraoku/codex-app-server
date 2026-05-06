# Codex App Server User Guide

Codex App Server は、外部ツールからローカルの Codex ワークフローへ安全に作業を委譲するための個人用 Gateway API です。

このガイドは API 利用者と運用者向けです。Codex App Server 本体の JSON-RPC、ローカルファイルシステムの絶対パス、作業ディレクトリは公開 API に出さない前提で運用します。

## できること

- 許可済みリポジトリだけを対象に Codex タスクを作成する。
- `read-only` または `workspace-write` の範囲でタスクの権限を制限する。
- API トークンにスコープと有効期限を付ける。
- タスクの状態、要約、変更ファイル一覧を Gateway の `taskId` で確認する。
- Codex アカウント状態を確認し、ChatGPT device-code login を開始する。
- 監査ログにはプロンプト本文ではなくハッシュと省略表示を残す。

## セキュリティ方針

- Codex App Server は内部 stdio プロセスとして実行し、JSON-RPC を直接公開しない。
- Gateway API は認証済みリクエストだけを受け付ける。
- `danger-full-access` は利用できない。
- 任意シェル実行 API は提供しない。
- App Server のファイルシステム API、コマンド API、`thread/shellCommand` は公開しない。
- Gateway API 経由で OpenAI API key や ChatGPT access token は受け取らない。
- トークンは作成時に一度だけ表示される。保存時はハッシュ化され、一覧 API でも生トークンは返らない。
- リポジトリはサーバー側の allowlist で解決する。クライアントから任意のパスは指定できない。
- 公開タスクレスポンスは Gateway の `taskId` を使い、Codex の内部スレッド ID は返さない。

インターネットへ直接ポートを開ける運用は避け、Tailscale、Cloudflare Tunnel、VPN、または同等の identity-aware な経路で公開してください。

## 初期セットアップ

必要なもの:

- Node.js 24
- npm

依存関係をインストールします。

```bash
npm install
```

環境変数の雛形をコピーします。

```bash
cp .env.example .env
```

`.env` で最低限次を設定します。

| 変数 | 用途 |
| --- | --- |
| `HOST` | バインドするホスト。既定は `127.0.0.1`。 |
| `PORT` | API ポート。既定は `8787`。 |
| `DATABASE_PATH` | SQLite データベースの保存先。 |
| `APP_BACKEND` | 実行バックエンド。既定は `codex-app-server`。 |
| `CODEX_APP_SERVER_COMMAND` | 起動する Codex CLI コマンド。既定は `codex`。 |
| `CODEX_APP_SERVER_TURN_TIMEOUT_MS` | App Server の turn 完了待ちタイムアウト。 |
| `TOKEN_PEPPER` | トークンハッシュ用の長いランダム秘密値。production では既定値不可。 |
| `BOOTSTRAP_ADMIN_TOKEN` | 初回トークン作成用の一時管理トークン。production では設定不可。 |

開発サーバーを起動します。

```bash
npm run dev
```

ヘルスチェック:

```bash
curl http://127.0.0.1:8787/healthz
```

## 初回トークン作成

初回だけ `BOOTSTRAP_ADMIN_TOKEN` を使って管理用 API トークンを作成します。このトークンに `token:*` スコープを含めておくと、`BOOTSTRAP_ADMIN_TOKEN` を削除した後も通常のトークン管理 API を使えます。

```bash
curl -X POST http://127.0.0.1:8787/v1/tokens \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin",
    "scopes": [
      "task:create",
      "task:read",
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

レスポンスの `token` は一度しか表示されません。保存後、`BOOTSTRAP_ADMIN_TOKEN` は `.env` から削除してください。

## スコープ

スコープはトークンができることを制限します。

| スコープ | 意味 |
| --- | --- |
| `task:create` | タスクを作成できる。 |
| `task:read` | タスクや許可済みリポジトリを読める。 |
| `token:create` | 新しいトークンを作成できる。 |
| `token:read` | トークン一覧を読める。生トークンは返らない。 |
| `token:revoke` | トークンを失効できる。 |
| `codex:account:read` | Codex アカウント状態を読める。 |
| `codex:account:login` | ChatGPT device-code login を開始またはキャンセルできる。 |
| `codex:account:logout` | Codex からログアウトできる。 |
| `repo:<repoId>` | 指定リポジトリを対象にできる。 |
| `mode:read-only` | 読み取り専用タスクを作成できる。 |
| `mode:workspace-write` | workspace-write タスクを作成できる。 |

`thread:create` と `thread:write` は互換性のために有効なスコープとして扱われますが、現行 API の主要操作は `task:*` を使います。

通常トークンは、自分が持っていないスコープを子トークンへ付与できません。また、子トークンの有効期限は発行元トークンの有効期限を超えられません。

## リポジトリ一覧

呼び出し元トークンが `repo:<repoId>` スコープを持つリポジトリだけを返します。

```bash
curl http://127.0.0.1:8787/v1/repos \
  -H "Authorization: Bearer $CODEXGW_TOKEN"
```

レスポンス例:

```json
{
  "repos": [
    {
      "id": "codex-app-server",
      "defaultMode": "read-only"
    }
  ]
}
```

## Codex アカウント認証

Codex アカウント操作は App Server の `account/*` を Gateway 内部から呼び出します。レスポンスには API key、access token、refresh token、raw JSON-RPC payload は含めません。

アカウント状態確認:

```bash
curl http://127.0.0.1:8787/v1/codex/account \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

ChatGPT device-code login 開始:

```bash
curl -X POST http://127.0.0.1:8787/v1/codex/account/login/device-code \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

レスポンスの `verificationUrl` を開き、`userCode` を入力します。進行中のログインを取り消す場合は `loginId` を指定します。

```bash
curl -X POST http://127.0.0.1:8787/v1/codex/account/login/cancel \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "loginId": "login_..." }'
```

ログアウト:

```bash
curl -X POST http://127.0.0.1:8787/v1/codex/account/logout \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## タスク作成

タスク作成には `task:create`、`repo:<repoId>`、`mode:<mode>` が必要です。`mode` を省略すると、サーバー側で定義された対象リポジトリの既定モードが使われます。

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

レスポンス例:

```json
{
  "taskId": "task_...",
  "status": "completed",
  "repo": "codex-app-server",
  "mode": "read-only",
  "summary": "task completed",
  "changedFiles": [],
  "createdAt": "2026-05-05T00:00:00.000Z",
  "completedAt": "2026-05-05T00:00:05.000Z",
  "error": null
}
```

プロンプトは 1 文字以上 20,000 文字以下です。リクエストボディに未知のフィールドを含めると検証エラーになります。

## タスク確認

タスク確認には `task:read` が必要です。タスク作成者本人は自分のタスクを読めます。別トークンで読む場合は、対象タスクの `repo:<repoId>` スコープも必要です。

```bash
curl http://127.0.0.1:8787/v1/tasks/task_... \
  -H "Authorization: Bearer $CODEXGW_TOKEN"
```

完了後は `status`、`summary`、`changedFiles`、`completedAt`、`error` を確認します。

## トークン管理

トークン作成:

```bash
curl -X POST http://127.0.0.1:8787/v1/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "readonly-client",
    "scopes": [
      "task:create",
      "task:read",
      "repo:codex-app-server",
      "mode:read-only"
    ],
    "expiresInDays": 30
  }'
```

トークン一覧:

```bash
curl http://127.0.0.1:8787/v1/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

トークン失効:

```bash
curl -X DELETE http://127.0.0.1:8787/v1/tokens/tok_... \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## エラー形式

エラーは次の形式で返ります。

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Forbidden"
  }
}
```

代表的なエラー:

| code | 主な原因 |
| --- | --- |
| `UNAUTHORIZED` | Authorization ヘッダーがない、形式が違う、トークンが無効。 |
| `FORBIDDEN` | 必要なスコープがない。 |
| `VALIDATION_ERROR` | リクエストボディやパラメータが不正。 |
| `TOKEN_EXPIRED` | トークンの有効期限切れ。 |
| `TOKEN_REVOKED` | トークンが失効済み。 |
| `REPO_NOT_ALLOWED` | allowlist にないリポジトリを指定した。 |
| `MODE_NOT_ALLOWED` | 対象リポジトリで許可されていないモードを指定した。 |
| `CODEX_NOT_CONFIGURED` | Codex 実行環境が未設定。 |
| `CODEX_EXECUTION_FAILED` | Codex タスク実行に失敗した。 |

## 運用チェックリスト

- production では `TOKEN_PEPPER` を長いランダム値に変更する。
- production では `BOOTSTRAP_ADMIN_TOKEN` を設定しない。
- 外部公開時は API の前段に認証・アクセス制御レイヤーを置く。
- トークンは用途ごとに短い有効期限と最小スコープで発行する。
- `workspace-write` は必要なクライアントだけに付与する。
- Codex アカウント操作スコープは管理者用トークンだけに付与する。
- 監査ログとサーバーログに機密値が出ていないことを定期的に確認する。

## GitHub Pages で公開する

このリポジトリは GitHub Actions で `docs/` 配下の Jekyll site をビルドし、GitHub Pages に公開します。

1. GitHub の repository settings を開く。
2. `Pages` を開く。
3. `Build and deployment` の source が `GitHub Actions` になっていることを確認する。
4. `main` に docs または `.github/workflows/pages.yml` の変更を push する。
5. `Deploy GitHub Pages` workflow の完了後、表示された Pages URL にアクセスする。

このガイドは workflow 内の Jekyll build で Markdown から HTML に変換されます。
