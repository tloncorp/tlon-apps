# ACP boundary

Clients use Agent Client Protocol (ACP) to reach Harness. The `%acp` Gall agent
carries JSON-RPC frames; `%harness` handles conversations. The browser and stdio
adapter use the same interface.

```text
browser ─┐
editor ──┼─> independent %acp queues ─> %harness sessions
service ─┘
```

Each connection has separate, ordered client and agent queues that survive
reloads. Clients acknowledge consumed frames; Harness acknowledges admitted
inputs. Connections cannot consume one another's updates.

Queue admission is bounded by both count and bytes: 1,024 frames and 4 MiB per
direction on one connection, with 8,192 frames and 16 MiB across all connections.
Individual frames are limited to 1 MiB.
Acknowledgements release space. Full queues reject new frames; closing a
transport allows its queues to be discarded without deleting conversation
history. After a missing response, inspect saved state before retrying a write.

## Protocol surface

### Conversation commands

Send commands as ordinary `session/prompt` text. Harness advertises `/help`,
`/status`, `/model`, `/context`, `/compact`, `/memory`, `/remember`, `/forget`, `/work`, and
`/stop` using ACP's `available_commands_update` on
session creation, load, and resume. React, native `%send`, and all conversation
hands use the same command interpreter; adapters do not implement command logic.

| Command | Effect |
| --- | --- |
| `/help` | List commands and usage. |
| `/status` | Show provider/model, tool-grant count, recorded token usage and a safe description of the last failure. |
| `/model` | Show the conversation's provider and model. |
| `/model <id>` | Change the model within the current provider. |
| `/model default` | Copy the current default provider/model settings into this conversation. |
| `/context` | Inspect the encoded-request estimate, input/output budgets, retained context and compaction usage. |
| `/compact` | Summarize older complete exchanges through the configured summary route; retain the recent turn and full transcript. |
| `/memory [query]` | Inspect or search shared memories. |
| `/memory off` / `/memory on` | Disable or enable shared memory for this conversation and its descendants. |
| `/remember <name> <text>` | Save or correct a shared fact. |
| `/forget <name>` | Forget a shared fact; earlier messages and checkpoints are retained. |
| `/work` | Inspect and manage work; protected changes need confirmation. See [work commands](work-control.md). |
| `/stop` | Cancel the current turn and queued hand work; acknowledge locally. |

Only `/compact` calls a model. Work management requires current owner or scoped
workspace authority; the other commands require no tool grant. Model changes retain
the conversation's instructions, history and tool permissions. A typed model
name is not an access check; the provider may reject it on the next real prompt.
Changing to an uncatalogued model uses the same 800,000-token context fallback as
the settings client. `/model default` copies the default's context limit.

Snapshots expose selected shared memories as `memory: [{name, body}]`. Edits append
`memory-set` events (`body: null` forgets) alongside the command reply.
See [shared memory](context-and-memory.md#shared-memory) for limits.

Only an exact `/stop` (ignoring surrounding whitespace) interrupts active work.
Other commands submitted through ACP while busy get the normal busy error;
hands queue them until settlement. Hand authorization and source-event
deduplication happen before interruption: replaying an old stop cannot cancel
a newer turn. Admission/storage limits still apply. Cancellation fences late
results but cannot undo external actions already started.

Commands are recognized only at human ingress, not in model/tool output, timers
or subagent instructions. Lowercase slash words reserve the command namespace;
unknown commands reply with help guidance. Paths such as `/tmp/file` and `//`
escapes remain ordinary text. Each accepted command records its input and a
`command-completed` audit event linked by input ID. Successful `/compact` instead
records its acknowledgement in `checkpoint-completed`, following the frozen
`lcm-planned` event. Replies appear in the shared transcript and ordinary
ACP/hand output. Summary usage is included in cumulative usage and separately
reported as `compactionUsage`; failed summaries retain the prior context and do
not automatically retry. See the [ACP slash-command protocol](https://agentclientprotocol.com/protocol/v1/slash-commands).

### Methods

- `initialize`
- `session/new`
- `session/list`
- `session/load`
- `session/resume`
- `session/close`
- `session/delete`
- `session/prompt`
- `session/cancel`
- `session/update` for user and assistant messages, tool calls, and results

Harness extensions use the same JSON-RPC connection:

`session/list` orders conversations by durable modification time, descending,
and includes `modifiedAt` as Unix milliseconds. Reads do
not modify this timestamp. Creation, accepted input, results, configuration and
rename do; deletion removes the index entry. An unavailable modification time
is null.
The GUI searches conversation names across the list and shows 20 matches at a
time, with explicit loading of additional matches. That name filter does not
read bodies; **Search content** uses the separate indexed corpus methods below.

- `harness/status`
- `harness/tools`
- `harness/skills` — shared catalog, with names and descriptions only.
- `harness/skill` — read one skill by `name`, including instructions and revision.
- `harness/skill/save` — owner save with `name`, `desc`, `body`, and `revision`.
  Creation requires an empty revision; updates require the revision from the last
  read. Conflicts leave the current skill unchanged. Names are 1–128 UTF-8 bytes,
  descriptions at most 1024, and instructions 1–65536. No Markdown parsing or
  tool-permission changes occur when saving.
- `harness/skill/delete` — owner deletion by name and matching revision.
  Settings exposes these shared instructions in a themed plain-text editor;
  attributed shared facts remain a separate resource.
- `harness/defaults`
- `harness/defaults/configure`
- `harness/summary-models` — `{compaction: config|null, lcm: config|null}`.
- `harness/summary-models/configure` — accepts `{models: {compaction, lcm}}`;
  null follows the current global default. Credentials use the existing store.
- `harness/corpus/status` — indexed record/conversation counts, indexing lag and epoch.
- `harness/corpus/search` — `{query, cursor?, limit?}`; ≤512 query bytes and
  1–64 results (default 16). Returns `{hits, cursor, complete, status}`.
- `harness/corpus/read` — `{scope, eventCount, offset?}`; returns a UTF-8-safe
  ≤12,000-byte body chunk, record metadata and nullable `nextOffset`.
- `harness/corpus/expand` — same address fields; returns summary `depth`, up to
  16 immediate `sources` and nullable `nextOffset`. Follow child summaries
  explicitly to reach original records.
- `harness/corpus/rebuild` — explicitly resets the disposable index and queues
  bounded backfill; source scope IDs survive, old cursors do not.
- `harness/search/status` — conversation and workspace index status, backlog and
  Notes availability. These unified search methods are owner-only.
- `harness/search/query` — `{query, cursor?, limit?}`; merges conversation evidence,
  accepted artifact history and current projects/tasks. Artifact revisions are
  grouped before pagination; hits include `matchCount` and `currentMatches`.
- `harness/search/versions` — `{kind: "artifact", id, query, searchToken, offset?, limit?}`;
  expands only the matching accepted revisions of a grouped hit.
- `harness/search/read` — `{kind, id, query, searchToken, revision?, offset?}`;
  bounded, read-only matched source content. Stale tokens and unavailable Notes
  content fail closed. Conversation source reading still uses corpus methods.
- `harness/session/use-default-model` — adopt model defaults for an existing
  session without changing its instructions or grants; does not retry work.
- `harness/mcp/servers`
- `harness/mcp/configure`
- `harness/session/config`
- `harness/session/configure`
- `harness/workspace` — editable artifacts, projects, proposals, tasks and
  owner-controlled publication; see [workspace actions](workspaces.md#interfaces-and-bounds).
- `harness/session/rename`
- `harness/session/snapshot`
- `harness/session/history`
- `harness/session/runs`
- `harness/session/fork`
- `harness/credential/set`
- `harness/provider/models`
- `harness/hand`
- `harness/cron` — optional `{binding}`; shared jobs across hands.
- `harness/cron/add` — `{id, binding, actor, kind, args}`; idempotent bounded job creation.
- `harness/cron/cancel` — `{id}`; stops future work, not dispatched effects.
- `harness/cron/clear` — `{id}`; removes settled schedule records, retaining evidence.

See [shared scheduling](scheduling.md) for the native equivalent, authority,
and limits.

`harness/hand` connects chat adapters. `initialize` advertises version 2 and
the `publish` capability under `_meta["harness/hand"]`. These clients have owner
authority; hand IDs are not credentials. See [hands](hands.md) for actions and recovery.

`session/load` replays the durable transcript, not the compacted model
context, before its result when it fits the single-load budget (40 rows and
256 KiB of transcript JSON). Larger loads return an explicit error before any
replay frames; use `session/resume` and paged `harness/session/history`.
`session/resume` attaches without replay;
`session/close` detaches without cancelling. Text prompt
blocks are joined; image, audio, embedded context, and client-supplied MCP
servers are not advertised. Filesystem and terminal authority stays behind
explicit Harness tools.

`session/cancel` settles the active prompt with `stopReason: "cancelled"`.
Unfinished tool calls receive terminal `tool_call_update` frames with status
`failed` and a cancellation explanation (ACP has no separate cancelled tool
status). Snapshot tool receipts additionally expose `cancelled: true`, so
clients can label interruption distinctly. Completed sibling results remain
intact. The next prompt does not repeat the interrupted calls; cancellation
is not a guarantee of external rollback. Request-form cancellation is
acknowledged as well as supporting the protocol notification form.

While a prompt is active, the client displays a thinking indicator. Harness
projects incremental provider text as presentation-only
`harness_agent_stream_chunk` updates whenever Iris exposes response progress.
Each update carries the durable log `revision`, a UTF-8 byte `offset`, and
`content: {type: "text", text}`. Clients render contiguous chunks immediately,
ignore duplicates and stale revisions, and recover gaps with a snapshot. An
in-flight snapshot cannot replace a newer displayed prefix.
Those chunks are presentation state: only the completed assistant item enters
the event log and the standard `agent_message_chunk` update. Providers or HTTP
paths that deliver the response as one completed body retain the thinking
indicator until that terminal update. Tool progress is emitted as the event
log changes.

`harness/session/snapshot` takes `sessionId` and optional numeric `since`.
It returns `revision`, `phase`, `model`, `error`, cumulative `usage`,
`compactions`, `compactionUsage`, `origin`, chronological recent `entries`, and
`before`. When `since` equals the current revision, `entries` is null: retain
the prior entries and cursor. An empty array
means the transcript is empty. ACP also includes accumulated `streaming` text
while a normal provider turn is active. Snapshots are readable from any
authorized connection, not just the one that started a prompt.

`harness/session/runs` is an owner-only inspection endpoint. It takes `sessionId`
and returns a page of up to 24 input summaries with a numeric `before` cursor.
Pass that cursor to read earlier inputs, or pass `lensId` to read one bounded
Context Lens record. Records include the first-dispatch journal context, tool
arguments/results, reply and hand delivery receipts. Reads never run tools or
inference. Timings absent from the journal remain null; provider reasoning and
transport credentials are excluded.

`harness/session/history` takes `sessionId` and optional numeric `before`, an
exclusive event-count cursor. It returns `revision`, chronological `entries`
and the next `before` (null at the beginning). Pages target 40 rows or 256 KiB;
rows from one event stay together, so a single event may exceed that target.
No message text is truncated or deleted. New events do not shift older cursors.
The browser preserves loaded history across overlapping live updates; after a
disconnected gap it starts a fresh pageable window instead of concealing the gap.
Paging bounds projection output, not reducer replay: inspection still traverses
retained history, and long-session CPU and loom costs remain capacity concerns.

Entries carry a stable `id` (the decimal event count), numeric `eventCount`,
and optional `inputId`. Pass optional `clientMessageId` with `session/prompt`;
the `harness_prompt_admitted` update echoes it alongside the durable `inputId`.
Match that id against the snapshot to remove optimistic display. Text matching
is not an admission check: identical prompts are legitimate distinct inputs.

`harness/session/fork` takes `sessionId`, a new unused `name`, and `eventCount`
from a tool-free completed assistant reply. It returns the child `sessionId`.
The child retains that prefix and records its origin without replaying effects.

## Provider authentication

Built-in providers store the chosen authentication route as their configuration
URL. Custom providers allow editable endpoints and headers.

| OpenAI authentication | Credential slot | Inference route |
| --- | --- | --- |
| API key | `openai` | `https://api.openai.com/v1/responses` |
| Device login | `openai-device` | `https://chatgpt.com/backend-api/codex/responses` |

`harness/credential/set` stores a credential under its `provider` slot. Device
refresh tokens and account identity use `openai-refresh` and `openai-account`;
they are not model credentials. Account headers are attached at dispatch only
for the ChatGPT route, including its model catalog. API and device model-list
requests use the same credential separation as inference. There is no fallback
between API and device credentials. A missing selected OpenAI credential stops
inference locally with an authentication error.

`harness/status` for `provider: "openai"` returns `has-api-key`,
`has-device-login`, and a suggested `auth-method` (`api-key` or `device`) in
addition to `has-key`. The suggestion honors OpenAI defaults when configured,
otherwise prefers an available device login. An existing conversation retains
its explicit selection. React uses this status when selecting OpenAI from a
different provider, rather than resetting unconditionally to the API route.

Device login saves credentials and the selected configuration before showing
Connected. Each conversation can choose its authentication route in model
settings; changes apply to subsequent requests.

Subscription and API-key authentication are separate access modes; see
[OpenAI authentication](https://learn.chatgpt.com/docs/auth). OpenAI device
credentials renew on the ship when a request arrives within five minutes of
expiry, including model-catalog and compaction requests. There is no browser
refresh loop or idle polling. Concurrent requests share one renewal; up to 64
credential-free requests can wait for at most 30 seconds. Cancellation removes
waiting work. A new login fences old responses, and rotated access/refresh tokens
are saved together. Temporary failures have a one-minute retry cooldown;
rejected credentials require a new login. Failures settle the waiting requests
and appear in the conversation or catalog, without exposing the token response.

An OpenAI device login should call `harness/credential/set` once with
`provider: "openai-device"`, `key`, `refreshToken`, and `account`. Empty optional
strings explicitly clear values from a previous login. Status also exposes
`auto-renew`, `renewing`, and a sanitized `renewal-error`, never token values.

## Shared web search and MCP discovery

`harness/credential/set` with `provider: "brave"` stores the Brave Search key;
an empty key removes it. `harness/status` with the same provider reports only
`has-key`. The React client exposes this under Settings → Search.

The `web_search` tool takes `query` under the Web grant and returns at most
five titles, URLs and excerpts. Select Brave or SearXNG in Settings → Search.
Brave uses a fixed JSON POST endpoint and a ship-supplied subscription header.
SearXNG uses form POST to the configured instance's `/search`; the instance
must enable JSON results. Both return the same bounded result shape.
The model cannot select the search endpoint or obtain its credential.

`http_fetch` can read a result with GET. Search results and fetched text are
untrusted reference material, not instructions. Configuring search does not add
permissions to existing conversations or trusted Tlon actors.

With a named MCP grant such as `{"mcp":"calendar"}`,
`list_mcp_servers` discovers granted, enabled IDs and names without exposing
URLs or headers. The bot uses `list_mcp_tools` and `call_mcp_tool` with those IDs.
Discovery reads the current registry on demand; registering a server alone
does not grant access. See [MCP configuration](integrations.md#mcp-client-configuration).

## Recovery

The web client creates a fresh connection identifier for each page instance,
polls quickly without cache while visible, cumulatively acknowledges frames,
and reopens that connection when a scry reports it missing. Already consumed
frames are not processed again if acknowledgement was lost. Pending calls are
rejected on queue loss, not automatically resent: a missing queue does not
prove a mutation was never admitted. Read the session snapshot before retrying.
Page exit closes the queue; the broker prunes closed connections before
admitting new ones.

The stdio process performs the same projection over authenticated Eyre. Its
stdout contains only ACP NDJSON, so diagnostics go to stderr.

ACP retains transport frames; Harness retains conversation state.
