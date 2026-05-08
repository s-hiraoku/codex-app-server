# Task Control

Task control covers future `interrupt` and `steer` operations for active Gateway tasks.

This repository does not currently expose task control endpoints. The current task runner hands an isolated Codex App Server stdio transport to one `runTask()` call and closes that transport when the task completes. There is no retained active session handle that can safely receive control messages after the public task has been created.

## Candidate APIs

These endpoints are reserved for a future phase:

```text
POST /v1/tasks/:id/interrupt
POST /v1/tasks/:id/steer
```

They should remain unimplemented until the Gateway has an active task session registry.

## Required Session Model

A safe implementation needs server-side state that maps a Gateway `taskId` to an active session handle. That handle must never be a Codex internal thread ID exposed to clients.

The registry should track:

- Gateway `taskId`
- owning token ID
- repo ID
- task mode
- task status
- cancellable runner/session handle
- creation and completion timestamps

The registry must be process-local unless persistence and recovery semantics are explicitly designed. If the Gateway restarts, active controls should fail closed rather than attempting to recover hidden Codex internals from public input.

## Authorization

Authorization should match `GET /v1/tasks/:id` before any control-specific checks:

- the creating token can control its own active task;
- a different token requires `task:read` plus `repo:<task.repo>`;
- future write/control scopes may be added, but they must not weaken repo or ownership checks.

Control APIs should only operate on active tasks. Completed or failed tasks should return a deterministic conflict-style error once that error code exists.

## Steer Payload

Future `steer` should accept a small, structured body such as:

```json
{
  "message": "Please focus on tests before editing docs."
}
```

The message should use the same prompt handling discipline as task creation:

- do not store full steering text in audit logs;
- store hashes or omitted previews only;
- scrub public event payloads;
- reject secrets and oversized bodies through validation.

## Public Events

If implemented, task control should append normalized events:

- `approval.resolved` only for approval-like decisions;
- `task.failed` if an interrupt causes failure;
- a future `task.interrupted` or `task.steered` event only after it is added to the public event schema.

Raw Codex App Server JSON-RPC payloads must not be stored or replayed.

## APIs Not To Add

Do not add any of the following as shortcuts for task control:

- raw `cwd` control APIs;
- arbitrary process signal APIs;
- arbitrary shell execution APIs;
- public `thread/interrupt`, `turn/steer`, or `thread/shellCommand` pass-through;
- generic App Server JSON-RPC proxying;
- request bodies that contain Codex internal thread IDs;
- request bodies that contain OpenAI API keys, ChatGPT access tokens, refresh tokens, or session secrets.

Until the active session model exists, `POST /v1/tasks/:id/interrupt` and `POST /v1/tasks/:id/steer` should continue to be absent from the public API surface.
