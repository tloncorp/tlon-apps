# ACP clients and the optional stdio bridge

`harness-acp.mjs` projects the on-ship `%acp` queues onto newline-delimited
JSON over stdin/stdout. It contains no agent loop and stores no transcript.

The API runs on the ship, not in this script. The browser and HTTP-capable
services connect directly through authenticated Eyre; native Urbit apps can
use pokes, watches and scries. No local Node process is required for those clients.

Use this bridge only when a client expects to launch an executable and exchange
ACP over stdin/stdout. An HTTP endpoint cannot supply a local process's streams
without a client-side bridge.

```text
ACP client <-- NDJSON --> harness-acp.mjs <-- authenticated Eyre --> %acp
```

## Run

Requirements are Node 22 or newer, an installed `%harness` desk, the ship URL,
and the output of `+code`.

```sh
SHIP_URL=http://localhost:8081 \
SHIP_CODE=your-ship-code \
node /path/to/urbit-agent-harness/acp/harness-acp.mjs
```

An editor such as Zed can spawn that command with the same environment. There
is deliberately no embedded login code.

| Variable | Default | Meaning |
|---|---|---|
| `SHIP_URL` | `http://localhost:8081` | Ship HTTP origin |
| `SHIP_CODE` | required | Ship login code |
| `ACP_CONNECTION` | random `harness-stdio-…` | Durable connection identifier |
| `ACP_POLL_MS` | `100` | Queue polling interval |

Independent processes get distinct connections by default. Set a stable
`ACP_CONNECTION` only when intentionally resuming the same ordered queue;
do not share an active identifier between independent clients.

## Behavior

The adapter logs in, opens its connection, forwards every valid input frame to
the agent queue, writes client frames to stdout in sequence order, and
acknowledges them after writing. Invalid input receives a JSON-RPC parse error.
Diagnostics are written to stderr.

ACP session methods and Harness extensions are documented in
[`docs-refs/acp.md`](../docs-refs/acp.md). The adapter does not proxy ambient
filesystem or terminal methods; those capabilities are granted to a session as
Harness tools.

## Conversation hands

`hand-client.mjs` adapts any initialized `call(method, params)` client to the
on-ship `harness/hand` method. It is an optional helper library, not a server or
required adapter process. Call the method directly when a helper is unnecessary;
see [HTTP connection details](../docs-refs/integrations.md#acp-over-authenticated-eyre).
It manages no transport or model loop. Bind a source
to a configured session, admit observations with stable source ids, and deliver
the independent publication outbox with claims and receipts. Native adapters
use the same contract without ACP. See [hands](../docs-refs/hands.md) for the
protocol, authority boundary, recovery rules, and an integration example.

The same helper exposes `schedule`, `schedules`, `cancelSchedule`, and
`clearSchedule` through the head-owned `harness/cron` namespace. Scheduling is
available to any authorized hand and uses its existing delivery outbox; see
[shared scheduled work](../docs-refs/scheduling.md).

## Smoke test

Start the adapter and enter:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":1}}
{"jsonrpc":"2.0","id":2,"method":"session/new","params":{"name":"editor-test"}}
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"editor-test","prompt":[{"type":"text","text":"Reply with ACP_OK"}]}}
```

The prompt first yields a `user_message_chunk`, then an assistant update and a
terminal result.

## Connected agents: Claude Code, Codex, and ACP

`connected-runner.mjs` connects **outbound** to the ship over HTTPS and SSE.
The ship never connects to your computer. Model authentication stays local;
the runner uses a dedicated key, not a ship login code or browser cookie.
Requirements: Node 22+, Linux or macOS, the ACP runner script, and a locally installed,
authenticated agent. Claude Code uses `claude-agent-acp`; Codex uses
[`codex app-server`](https://learn.chatgpt.com/docs/app-server).

In **Settings → Providers → Connected agent**, create a named connection,
download its key, and follow the generated command. Keep the key and state
outside the coding repository. For example:

```sh
chmod 600 /private/claude-laptop.key
node acp/connected-runner.mjs \
  --ship https://your-ship.example \
  --runner YOUR_RUNNER_ID \
  --key-file /private/claude-laptop.key \
  --repo /absolute/path/to/project \
  --state /private/claude-laptop.json \
  --agent acp \
  --harness-tool current_time
```

For Codex, create another connection and run another process with its own key
and state, using `--agent codex`. Both can run on the same computer. Each
conversation/channel chooses **Connected agent → its named connection** in
its conversation settings. Global defaults apply to new conversations only.
Pairing a connection does not change any conversation's provider or tool grants.
The runtime and repository belong to the local connection; remote prompts
cannot choose an executable, working directory, model, or local permission policy.

Codex accepts `--model MODEL` and `--sandbox read-only|workspace-write`, with
read-only as the default and approval requests declined. ACP accepts repeated
`--allow` permission kinds as described below; configure its model locally.
Append `-- your-acp-command args...` for another ACP executable. A repo working
directory is not an ACP sandbox. Local credentials, agent configuration and
hooks are inherited; runner and loopback bearer environment variables are
removed from the agent environment.

`--harness-tool NAME` is a local ceiling, intersected with the conversation's
current Harness tools. With no flags, no Harness tools are exposed. The local
agent sees the `harness` MCP wrappers described below. Tool calls execute
through Harness's normal dispatcher and ledger; the matching result resumes
the same local coding turn. A runner key accesses only that runner's assigned
prompts and replies, never owner configuration or arbitrary ship tools.

### Connection and recovery

Each conversation has a separate local agent session and journal. Several
connections and conversations can run concurrently. One process owns each
runner identity and journal. Use distinct keys, IDs, and state paths for
independent processes. The ship retains up to 64 runner identities; revocation
is permanent for an identity. The runner loads at most 16 conversations per
process and retains 4096 attempt receipts. Limits fail explicitly without
evicting safety records. Per-conversation provider receipts retain 64 responses.

SSE reconnects from a durable cursor. Replies use an ordered, persisted POST
outbox; a lost acknowledgement retries the same event, not the coding prompt.
A crash with uncertain execution reports an interruption instead of rerunning
work. Stop, changed session lineage, timeout, and key revocation fence replies;
Stop also cancels a local agent waiting on a Harness tool. Cancellation is
best-effort and cannot roll back edits or completed external effects.

On interruption, inspect the repository, local agent and ship tool effects.
Keep the journals; use a fresh conversation for further work. Do not erase
uncertainty markers or replay a task blindly. A stale `.lock` file may be removed
only after checking that its recorded process is gone. A changed connection
or execution policy requires a separately paired runner and state path.

Do not edit/fork a connected conversation's transcript or change its system
instructions mid-session: follow-ups must extend its saved history exactly.
Compaction rewrites that history; use a fresh conversation when the context
budget is reached. A connected agent cannot itself serve as a summary provider.

The registry stores a key digest, but the creation event can remain in the
ship's event log and backups. Protect those as credentials. The UI keeps a new
key only until setup is dismissed or the page closes; it is not recoverable
from the registry. Revoking prevents new claims and replies immediately; an
already-running disconnected process discovers revocation on its next request.

### Runner protocol

`GET /harness/runners/:id/events` takes `Authorization: Bearer hrr_…` and
`Last-Event-ID`. It returns SSE `event: harness`, a decimal sequence `id`, and
JSON `{version:1,type:"prompt"|"cancel",conversationId,turnId,attemptId,kind,request}`.
Prompts contain ordinary Chat Completions messages and tool schemas. Cancellation
uses the exact attempt identity and a null request. Heartbeat comments arrive
every 15 seconds; the client reconnects after 45 seconds without activity.

`POST` to the same endpoint uses `application/json` with `version:1`, a strictly
increasing `sequence`, and `type`: `ack` with `through`, or `claim`, `delta`,
`complete`, `failed` with the three attempt identity fields. `delta` adds `text`;
`complete` adds the ordinary Chat Completions `response`. Claim before execution.
Only an identical retry of the last accepted POST receives its saved receipt.
An inactive attempt is acknowledged and discarded, never dispatched again.
The client durably accepts delivery before advancing its cursor and acknowledges
delivery independently of execution. HTTP 4xx errors fence the runner except
408/429; transport failures retry with bounded backoff.

HTTPS is mandatory except loopback. Cookies do not authenticate these endpoints;
browser Origin headers and query parameters are rejected. Prompt bodies are
bounded to 1 MiB, POST events to 256 KiB, reply text to 128 KiB, and retained
delivery to 256 events / 4 MiB with reserved control capacity. Active requests
time out after 30 minutes. Streams close on reload and reconnect from the
retained queue; reload never resubmits local execution.

Run `SHIP_URL=http://127.0.0.1:PORT SHIP_COOKIE=/private/cookie SOAK_EXPECT_SHIP='~your-ship' node tests-js/connected-runner-conformance.mjs`
against an isolated development ship to verify two concurrent connections and
native clock/math tool continuation. It creates and removes its fixture
conversations, revokes its test keys, and retains the revoked registry identities.
Both transport fixtures use a deterministic ACP process; Codex's adapter has
separate protocol tests. No model calls or real repository edits occur.

## Loopback coding-agent provider

`local-agent-provider.mjs` runs the opposite direction: one Harness conversation
uses a local ACP coding agent as its custom model provider. The ship receives
and delivers the DM; the local agent owns coding, tool execution, and its own
model connection. No desk code changes are required.

Requirements: Node 22+, Linux or macOS, a ship reachable from the same host,
and an installed, authenticated ACP agent. For Claude, install
[`@agentclientprotocol/claude-agent-acp`](https://github.com/agentclientprotocol/claude-agent-acp)
and complete the agent's local authentication setup. The executable is
`claude-agent-acp`. Claude's authentication is separate from the bridge token.

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

### Start the runner

Use the ACP runner script. Keep the state file outside the coding project.
Generate a private token once and retain it securely for restarts:

```sh
export HARNESS_ACP_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"

node acp/local-agent-provider.mjs \
  --repo /absolute/path/to/project \
  --state /absolute/private/path/dev-dm.json
```

By default, the runner denies every ACP permission request. To explicitly
approve individual requests for editing and command execution, add
`--allow edit --allow execute`. Other supported kinds are `read`, `search`,
`fetch`, `delete`, and `move`. The runner selects only `allow_once`, never a
persistent approval or a mode switch. Unsupported approvals are denied, not
forwarded as interactive questions to the DM.

**These flags are not a sandbox.** They govern permission requests the ACP
agent actually sends; its existing local settings may already permit tools.
The agent inherits local credentials, hooks, and environment (except the bridge
token), and an allowed command can act outside the working directory. Use a
trusted checkout and a suitably restricted local account or sandbox. In
particular, `--allow execute` does not distinguish tests from destructive shell
commands, commits, pushes, or network access.

`--port` defaults to `8789`; `--timeout-ms` defaults to `1800000` (30 minutes).
To use another ACP executable, append `-- /absolute/path/to/agent args...`.
The command runs without a shell, in the fixed `--repo` directory.
Do not start `claude-agent-acp` separately: it waits for ACP JSON-RPC on stdin,
not interactive terminal input. The runner starts it when a conversation first
needs it and manages its lifetime. The Harness MCP facade also starts automatically.

### Configure one Harness conversation

Use a fresh, owner-only DM conversation. Configure that conversation, **not
global defaults**, with:

| Setting | Value |
| --- | --- |
| Custom provider endpoint | `http://127.0.0.1:8789/v1/chat/completions` |
| Model | `local-acp` |
| Provider header | `Authorization: Bearer <the value of HARNESS_ACP_TOKEN>` |
| Harness tools | Only the grants needed for this conversation; see the relay below |
| Provider fallback routes | None |

The runner binds only to IPv4 loopback. A ship in a VM or container has a
different localhost; this setup requires shared host networking or a separately
secured forwarding arrangement. Do not expose the runner publicly. The token
authorizes local coding work: keep it out of shared project files and do not
reuse it for other conversations.

Send a small read-only request first, such as “Describe this repo's test setup.”
Follow-up DMs continue the same ACP session. Replies stream as text; Claude's
local coding tools execute locally and are not projected into Harness tool cards.

### Enable Harness tools for the coding agent

The relay is disabled by default. Enable an explicit local ceiling when starting
the runner, for example `--harness-tool current_time --harness-tool calculate`.
Use `--harness-tool '*'` only to allow all tools advertised for the conversation.
The available set is the intersection of this ceiling and the current request's
tool schemas. Harness still checks current authority when executing each call;
the local ceiling never grants ship permissions. Changing the ceiling requires
a separate state file and conversation.

Claude sees one MCP server, `harness`, with two wrappers: `list_tools` returns
names and descriptions, or the exact input schema when given a name;
`call_tool` takes that name and an arguments object. A call pauses the MCP
request and emits an ordinary Harness tool call. Harness executes it through
its existing dispatcher and tool ledger. The next provider request supplies
the matching result, resuming the **same ACP prompt**. Concurrent tool requests
are serialized into separate provider responses. Harness tool calls appear in
the conversation's normal tool history.

The facade uses a separate ephemeral loopback token, not the provider bearer
token or a ship login. The runner approves ACP permission requests for these
two exact wrapper names with `allow_once`; local coding tools remain governed
by `--allow`. With no relay enabled, advertised Harness schemas are ignored.

The endpoint accepts text Chat Completions requests, including tool history
when the relay is enabled. The `local-acp` model
name selects the bridge, not Claude's underlying model; configure that in the
local agent. Sampling/output-budget fields do not configure the ACP agent.
The bridge does not report model token usage or cost. It does not acquire agent
credentials, supply client filesystem/terminal methods, or install dependencies.

### Continuity, cancellation, and recovery

The private state file stores the ACP session ID, conversation history, and up
to 64 provider-response receipts. An exact repeated completed text request
returns its saved response without executing the task again, including after a
runner restart. Tool-call responses are never replayed. A continuation requires
the exact saved transcript plus the matching tool result ID.
Follow-ups must extend the saved transcript. Do not share this endpoint/state
between conversations, fork or edit its history, change its system instructions,
or use it as a summary provider. Compaction changes the transcript and requires
a fresh bridge state and conversation; use a separate summary provider where
applicable. Receipts are retained rather than silently evicted.

HTTP disconnection (including cancellation if the ship closes its request) and
the runner deadline request ACP cancellation. An unresponsive agent is stopped
with its process group. Stopping the runner also cancels active work. This is
best-effort cancellation: it cannot undo edits, stop detached external jobs, or
guarantee an in-progress external operation did not complete.

Between a tool-call response and its result, there is no open provider HTTP
request for a ship-side stop to close. Use authenticated `POST /cancel`, or stop
the runner, to cancel that parked turn immediately. `--tool-timeout-ms` bounds
the wait for a tool result (default 120000); the 30-minute coding deadline spans
all tool rounds. Cancellation does not clear the uncertainty marker.

An interrupted, crashed, or failed turn leaves a durable uncertainty marker.
The runner refuses further coding turns, even across restarts. Inspect the repo
and the local agent session, plus any ship tool effects, before proceeding. Keep the original state file,
then use a **new state file and new Harness conversation** for further work;
do not delete the uncertainty marker and blindly resend the task.

A `.lock` file prevents two runners from using the same state. After an abrupt
process death, verify that its recorded PID is no longer running before removing
only that stale lock. Do not remove or reset the state file to fix a lock error.
Restarting requires the agent's ACP `loadSession` capability; the runner never
reconstructs an agent session by replaying old coding prompts.

`GET /health` and `GET /v1/models` require the same bearer token and do not start
the agent. Health reports `waitingForTool`, `needsInspection`, and
`completedResponses`. Requests are limited to 1 MiB and total text per ACP turn
to 128 KiB. Invalid requests,
concurrent turns, and incompatible transcript changes are rejected before a
coding prompt is dispatched.

### Verify

```sh
node --test acp/*.test.mjs
```

The tests launch a deterministic ACP subprocess and the real stdio MCP facade.
They exercise HTTP/SSE, tool discovery and continuation, catalog revocation,
permissions, session loading, duplicate protection, cancellation, process
failures, and state locks without model calls or real repository edits.

To verify real ship dispatch on a local development ship, run
`SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/private/cookie SOAK_EXPECT_SHIP=~your-ship node tests-js/local-agent-provider-conformance.mjs`.
This creates and deletes one isolated fixture conversation, calls only
`current_time` and `calculate`, and makes no paid model calls or bot changes.
