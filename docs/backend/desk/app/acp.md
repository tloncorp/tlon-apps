# %acp

`%acp` is a generic, ship-native transport for Agent Client Protocol (ACP)
connections. It does not know about Tlon DMs, groups, owners, Codex, Claude, or
any other harness. Those concerns belong to clients and adapter workers layered
on top of it.

ACP is bidirectional JSON-RPC: either peer can issue requests, responses, and
notifications. `%acp` therefore carries opaque JSON-RPC frames in two durable,
ordered queues, one addressed to `%client` and one addressed to `%agent`.
Each payload is an opaque newline-delimited JSON frame (`@t`), matching ACP's
stdio transport. Keeping the frame opaque allows capability negotiation,
extension methods, and future protocol versions to pass through without a desk
upgrade or Hoon JSON re-encoding.

## Deployment shape

```text
Tlon orchestration (ACP client)             adapter worker
  poke target=%agent                          subscribe peer=%agent
  subscribe peer=%client       <-> %acp <->   NDJSON stdio to codex-acp/etc.
  ack target=%client                          poke target=%client; ack agent
```

The adapter worker is intentionally small. It pumps JSON between an Eyre
subscription/poke pair and an adapter's newline-delimited stdin/stdout. The
official ACP SDK should own schema validation and protocol behavior; `%acp`
owns durable delivery and reconnection.

## State

Each connection stores:

- lifecycle (`open`, open time, optional close time/reason);
- an independent next sequence number for each receiving peer;
- unacknowledged messages addressed to `%client`;
- unacknowledged messages addressed to `%agent`.

Connections are capped at 32, each unacknowledged peer queue at 10,000
messages, and each NDJSON payload at 1 MiB. A poke exceeding a bound is
nacked rather than silently dropping protocol traffic.

## Pokes

All `%acp-action-1` pokes are local-only.

```json
{ "open": { "connection": "bot-runtime-1" } }
{ "send": { "connection": "bot-runtime-1", "target": "agent", "payload": "{\"jsonrpc\":\"2.0\",\"id\":0,\"method\":\"initialize\",\"params\":{}}" } }
{ "ack": { "connection": "bot-runtime-1", "target": "agent", "through": 1 } }
{ "close": { "connection": "bot-runtime-1", "reason": "adapter exited" } }
{ "drop": { "connection": "bot-runtime-1" } }
```

- `%open` creates a connection. Repeating it while open is idempotent.
- `%send` appends an opaque ACP NDJSON frame to the target peer's queue.
- `%ack` cumulatively removes queued messages through the supplied sequence.
- `%close` prevents new sends but preserves unacknowledged traffic.
- `%drop` removes a closed connection only after both queues are empty.

## Subscriptions and scries

Subscribe to `/v1/[connection]/client` or `/v1/[connection]/agent`. The initial
facts report connection state followed by all unacknowledged messages for that
peer. New messages arrive as `%acp-update-1` facts. Consumers should process in
`sequence` order and then cumulatively ack.

Scry `/x/v1/[connection]/client` or `/x/v1/[connection]/agent` for the current
unacknowledged queue.

The queue is transport replay, not ACP conversation persistence. ACP session
creation/loading/resumption remain protocol operations carried inside the JSON
envelopes and implemented by the selected adapter.

## Reference worker

`packages/acp` contains the generic `tlon-acp` stdio worker. It reuses the
monorepo's `@tloncorp/api` Urbit channel client and accepts the adapter command
as configuration:

```bash
URBIT_URL=http://127.0.0.1:8080 \
URBIT_SHIP=~sampel-palnet \
URBIT_CODE=sampel-palnet-sampel-dozzod \
ACP_CONNECTION=demo \
node packages/acp/dist/cli.js -- codex-acp
```

The worker acks an agent-bound message only after writing it to adapter stdin.
Adapter stdout is serialized into acknowledged pokes bound for the client
queue. This gives at-least-once delivery across a process crash: a crash after
the adapter accepts a frame but before the ACK reaches the ship may replay that
frame.
