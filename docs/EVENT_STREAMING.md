# Event Streaming

Task events are Gateway domain events for external clients. They are not tied to any specific UI.

## Endpoint

```text
GET /v1/tasks/:id/events
```

Authorization matches `GET /v1/tasks/:id`:

- `task:read` is always required.
- The task creator can read the event stream.
- Other tokens also need `repo:<task.repo>`.

The endpoint returns Server-Sent Events. The current implementation replays persisted events for completed or failed tasks and supports `Last-Event-ID`.

## SSE Format

Each event uses the Gateway event ID and normalized event type:

```text
id: 12
event: task.completed
data: {"id":"12","taskId":"task_...","type":"task.completed","payload":{"summary":"Task completed"},"createdAt":"..."}
```

Public event data contains:

- `id`: Gateway event ID as a string.
- `taskId`: Gateway task ID.
- `type`: normalized event type.
- `payload`: sanitized event payload.
- `createdAt`: event timestamp.

Public event data must not contain:

- Codex internal thread IDs.
- raw `cwd` or absolute local paths.
- Authorization headers or tokens.
- raw App Server JSON-RPC payloads.
- full prompts.

## Event Types

The initial type set is intentionally small and client-neutral:

- `task.started`
- `task.completed`
- `task.failed`
- `agent.message.delta`
- `agent.message.completed`
- `tool.started`
- `tool.completed`
- `file.changed`
- `diff.available`
- `approval.requested`
- `approval.resolved`

G1 persists these events when available:

- `task.started`
- `agent.message.completed`
- `file.changed`
- `diff.available`
- `task.completed`
- `task.failed`

## Normalized Codex Mapping

Codex App Server stream notifications are mapped inside the Gateway before persistence:

| App Server signal | Gateway event |
| --- | --- |
| task row inserted before runner starts | `task.started` |
| `item/completed` with `agentMessage` | `agent.message.completed` |
| `item/completed` with completed file changes | `file.changed`, then `diff.available` |
| runner result / turn completed successfully | `task.completed` |
| runner or turn failure | `task.failed` |

The Gateway stores only normalized and scrubbed payloads. It does not store or replay raw JSON-RPC payloads.

## Replay And Reconnect

Clients can pass `Last-Event-ID` to fetch only events with a greater event ID:

```bash
curl http://127.0.0.1:8787/v1/tasks/task_.../events \
  -H "Authorization: Bearer $CODEXGW_TOKEN" \
  -H "Accept: text/event-stream" \
  -H "Last-Event-ID: 12"
```

Live fan-out can be added later by introducing an active task session registry and broadcasting runner callbacks to connected SSE clients. That should be a separate phase because it changes task lifecycle management.
