# Connecting systems to Harness

Clients connect to conversations on the ship. Choose an interface based on
whether you need a full client, a chat connector, a tool, or a single input.

## Choose a boundary

| Need | Boundary | What it provides |
|---|---|---|
| Interactive agent client, editor, or service | ACP | Sessions, replay, prompts, cancellation, configuration, and live updates |
| Bidirectional conversation surface | Hand protocol over ACP or native nouns | Bindings, source-event deduplication, queued turns, and publication receipts |
| Small HTTP producer | Webhook | Fast admission of a text prompt into a named session |
| Another app on the same ship | Gall poke, watch, and scry | Typed nouns with no JSON or HTTP dependency |
| Scheduled work | `%timer-set` action | A durable Behn wakeup that admits a prompt later |
| Another Urbit | `%harness-a2a-0` | Typed asks tied to ship identity and an explicit peer grant |
| Remote tool service | MCP | Global endpoint registry plus per-conversation capability grant |

Use ACP for a full client and [hands](hands.md) for chat connectors that need
source identity and delivery tracking. Other interfaces serve narrower needs.

## ACP over authenticated Eyre

HTTP clients connect directly to the ship's ACP API. `harness/hand` is a method
on that API. The local JavaScript bridges are optional.

Each client opens a unique connection in `%acp`, sends JSON-RPC frames to its
agent queue, and watches or polls its client queue. Frames have monotonically increasing
sequence numbers and are acknowledged cumulatively. A client reconnecting to
the same identifier resumes its unacknowledged queue; a new page should choose
a fresh identifier.

The browser uses these endpoints:

```text
PUT /~/channel/<channel>                         poke %acp with %acp-action-1
PUT /~/channel/<watch-channel>                   subscribe to /v1/<connection>/client
GET /~/channel/<watch-channel>                   receive Eyre server-sent events
GET /~/scry/acp/v1/<connection>/client.json     read outbound frames
```

Use `Cache-Control: no-cache` or a query nonce for polls. The poke actions are
`open`, `send`, `ack`, and `close`; see `desk/sur/acp.hoon` for their exact noun
shape. Initialize the JSON-RPC connection before invoking session methods.

The browser uses a separate disposable watch channel and retains polling as a
fallback. Eyre's `ack` action acknowledges event IDs (starting at zero); the ACP
`ack` poke acknowledges message sequences (starting at one). They are separate
cursors. A lost watch does not justify replaying a command. See
[browser delivery and regression checks](performance.md#browser-idle-work-and-subscriptions).

For clients that launch a local agent process and speak stdin/stdout, the
optional dependency-free bridge exposes the same connection as NDJSON:

```sh
SHIP_URL=http://localhost:8081 \
SHIP_CODE=your-ship-code \
ACP_CONNECTION=my-editor \
node acp/harness-acp.mjs
```

Its stdin and stdout carry only ACP frames. Use a distinct
`ACP_CONNECTION` for each simultaneously running client.

The [ACP reference](acp.md#methods) lists session, configuration, provider,
tool, and hand methods.

`session/prompt` returns after the admitted turn reaches a terminal state.
Observe `session/update` notifications for the admitted user item, tool
progress, and answer. Admission is durable before provider inference begins.

Clients need not own the prompt to inspect the run. For example:

```json
{"jsonrpc":"2.0","id":10,"method":"harness/session/snapshot","params":{"sessionId":"research"}}
{"jsonrpc":"2.0","id":11,"method":"harness/session/snapshot","params":{"sessionId":"research","since":42}}
{"jsonrpc":"2.0","id":12,"method":"harness/session/fork","params":{"sessionId":"research","name":"alternative","eventCount":39}}
```

Use an actual completed assistant entry's `eventCount` as the branch point.
Snapshots report phase, revision, recent transcript entries, model, usage,
origin and a history cursor. Use `harness/session/history` for older pages. `entries: null` means the supplied revision is unchanged, not an empty
transcript. Keep the prior entries. Event counts survive context compaction.

`session/close` does not cancel work. `session/cancel` explicitly stops the
addressed session even when another connection started it. If a connection's
queue disappears, inspect before repeating a mutation: transport uncertainty
is not proof the ship rejected the action. Optional `clientMessageId` on a
prompt is echoed in `harness_prompt_admitted` with the durable `inputId` for
optimistic-display reconciliation; it is not an idempotency key.

## Native Gall integration

Poke `%harness` with mark `%harness-action` and an `action` from
`desk/sur/harness.hoon`. `%noun` accepts the same noun for convenient Dojo and
development use. A native client can then:

- watch `/session/<session-id>` for `%harness-update` facts;
- scry `/x/sessions` for session ids;
- scry `/x/session/<session-id>` for a derived view;
- scry `/x/events/<session-id>` for chronological events;
- scry `/x/snapshot/<session-id>` for the recent transcript window and cursor;
- scry `/x/head/<session-id>` for a typed noun containing revision, derived
  view, and next decision. Reading this does not execute that decision.

HTTP projections of those scries are available at:

```text
/~/scry/harness/sessions.json
/~/scry/harness/session/<session-id>.json
/~/scry/harness/events/<session-id>.json
/~/scry/harness/snapshot/<session-id>.json
/~/scry/harness/defaults.json
/~/scry/harness/mcp.json
```

Native actions cover conversations, execution, configuration, timers, skills,
peers, and MCP. Their types live in `desk/sur/harness.hoon`.

`[%fork-at from to at]` branches at a completed, tool-free assistant reply.
It uses the same pure gate as ACP, preserves the immutable history prefix,
and emits the new fork event to native watchers. A Hoon component can import
`/lib/harness-session` and call `inspect`, `snapshot`, or `branch` directly on
session nouns, without Gall, Eyre, a provider, or effect authority. Those gates
are useful for replay checks and rehearsals; they do not admit live work.

`next` in that same library combines the reducer with the request-budget
policy used by the ship. For a different policy, `decide` in `/lib/harness`
takes a view and a pure `~ -> @ud` budget gate; it evaluates the gate only when
inference could run. Provider codecs live in `/lib/harness-provider`, client
JSON in `/lib/harness-json`, and concrete execution bindings in
`/lib/harness-effects`. The head owns the session log.

## Webhooks

`POST /harness-api/webhook/<session-id>` with JSON `{"text":"..."}` admits a
prompt and returns `{"ok":true}`. It does not wait for or return the model
answer; consume the session through ACP, a watch, or a scry.

The webhook is an ingress primitive, not a public authentication scheme. Keep
it behind an authenticated reverse proxy, private network, or a purpose-built
channel adapter when exposing the ship beyond a trusted host.
Sessions with hand bindings reject webhook input; use authenticated hand
observations so an external producer cannot bypass the binding's actor checks.

## MCP client configuration

Settings → MCP stores a global registry of stateless Streamable HTTP servers.
Each entry has a stable id, display name, URL, enabled flag, and endpoint-bound
headers. Grant each server explicitly with `{"mcp":"server-id"}` in the
conversation's tools. A grant permits that server's tools; registration alone
grants nothing. The model uses:

- `list_mcp_servers()` to discover granted, enabled server IDs and names;
- `list_mcp_tools(server)` to request JSON-RPC `tools/list`;
- `call_mcp_tool(server, name, arguments)` to request JSON-RPC `tools/call`.

The model discovers a server's current schema only when needed, keeping remote
tool catalogs out of every prompt. Headers are sent only to the configured URL.
MCP results return through Iris and become ordinary tool-result events. The
client supports stateless endpoints, not session negotiation, server-sent
notifications or OAuth acquisition. A local `%mcp-proxy` also connects through
a native Gall bridge; see [local discovery](peers.md#local-mcp-discovery).

## Properties integrations can rely on

- Conversations survive client disconnects and agent reloads.
- Waiting on a provider or tool does not block other conversations.
- Inputs retain their source, timestamp, and reply route; branches retain their
  branch point.
- Execution checks current permissions, not just discovered schemas.
- New conversations copy global defaults; their later settings are independent.

`harness/session/use-default-model` takes `{ "sessionId": "..." }` and explicitly
adopts the current default endpoint, model, headers and context budget without
changing that session's instructions or tool permissions. This is useful for
clients managing existing conversations after changing defaults. It does not
retry failed work; submit new input or explicitly retry. React derives context
budgets from provider model metadata; the settings do not expose a manual budget
control. Endpoints without published limits use the 800,000-token fallback.

Keep conversation state in Harness; adapters handle their own transport.
