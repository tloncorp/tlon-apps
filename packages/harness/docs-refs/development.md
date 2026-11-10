# Development and verification

The build assembles an installable `%harness` desk from Harness sources, the
React app and pinned runtime dependencies. Live tests exercise the installed
desk; JavaScript and artifact tests also run without a ship.

## Repository map

| Path | Responsibility |
| --- | --- |
| `desk/app` | Gall lifecycle, ACP transport, static serving and Tlon adapter |
| `desk/sur` | Typed contracts and saved-state envelopes |
| `desk/lib` | Pure semantics, codecs, grants, projections and effect bindings |
| `desk/tests` | Default native unit tests |
| `desk/tests-integration` | Whole-agent tests and benchmarks, left out of the default desk |
| `acp` | Stdio adapter and conversation-hand helper |
| `scripts` | Fake-ship setup, test runners and `click` |
| `tests-js` | Artifact checks, live conformance fixtures and owner maintenance tools |
| `docs-refs` | Architecture, usage guides and protocol references |

[Architecture](architecture.md#code-boundaries) maps the main libraries.

## Assemble and install

| Recipe | What it does |
| --- | --- |
| `just fetch` | Runs `peru sync`, which vendors `desk-deps/` and `mcp/` |
| `just build` | Runs `peru sync`, then lays `desk-deps/`, the Tlon files and `desk/` into `desk-out/` |
| `just install DESK` | Runs `build`, then copies `desk-out/` into a mounted desk |
| `just commit DESK` | Runs `install`, then asks the running ship to commit that desk |
| `just fake-dev [SHIP] [DIR] [OWNER]` | Boots a fake ship in tmux, installs `%mcp` and `%harness` and runs `setup` |
| `just test [PATTERN]` | Runs `test-hoon`, then `test-js`, and fails if either fails |
| `just test-hoon [PATTERN]` | Runs the native Hoon tests on fake `~zod`: all of them on a fresh ship, or those matching the regex on a kept one |
| `just test-js [PATTERN]` | Runs the JavaScript tests that need no credentials: the `node --test` files, then the live scripts on fake ships, fresh or kept as above |
| `just setup PIER OWNER` | Sets the owner, enables the Tlon hand and turns on Context Lens sync |
| `just provider PIER NAME [MODEL]` | Connects a model provider and makes it the default |
| `just clean` | Removes `desk-out/` |
| `just distclean` | Also removes `desk-deps/` and the runtime downloaded into `.deps-cache/` |

This desk imports files it does not own. The tlon-apps `peru.yaml` pins the
standard libraries and marks from `urbit/urbit` (the `harness-base` module) and
the `%mcp` repository (`harness-mcp`), which its `scripts/sync-deps.sh` vendors
with [peru](https://github.com/buildinspace/peru). `tlon-files.txt` lists the
Tlon protocol types that its `scripts/assemble-desk.sh` copies from its `desk/`,
so they always match the Groups desk in the same checkout.

`just install` uses `rsync` without `--delete`, so development files in the mount
survive, and so do files this desk no longer contains. Remove those by hand.

`just commit` uses `scripts/click`, Tlon's `click` with the command passed on stdin
so credentials stay out of process arguments. It needs a running pier and `socat`.
The receipt confirms that Hood accepted the commit request; Gall recompilation and
native tests remain separate checks. The socket path `PIER/.urb/conn.sock` must be
under 108 bytes, so reach deep piers through a short symlink.

`just test-hoon` runs `scripts/test-hoon.sh`, which needs `tmux` but not `node`: the
native tests and integration tests on `~zod` alone. `just test-js` runs
`scripts/test-js.sh`: the `node --test` files and the live scripts on `~zod`, `~lux`
and `~nec`. They are the two CI jobs. Without a pattern, each boots fresh ships and
removes them, so the full `just test` boots `~zod` twice. Each keeps its results and
logs in `.test-run/hoon/` or `.test-run/js/`.

With a PATTERN, the ships stay running in `.test-run/piers/`, shared by both scripts, and
each run deploys the working tree. `test-js` wipes Harness's agent state with `|nuke`
before each live script, which sets up what it needs; state in other desks stays.
`just test --stop` removes the ships. Use the full `just test` before pushing.

`scripts/test-js.sh` gives live scripts their variables: the opt-ins, `CONTROLLED_MODEL=1`,
the ships' tmux panes and a `TEST_NEST` channel that `~lux` hosts and `~zod` has joined,
which `tests-js/lib/test-channel.mjs` creates once. Its `skip_reason` function names the scripts
it can't run and why.

`just fake-dev` runs `scripts/setup-fake-dev.sh`, which needs `tmux` and `mcp/`
from `just fetch`, and refuses a pier or tmux session that already exists. It uses
HTTP port 9090 unless `HTTP_PORT` is set.

Scripts in `scripts/harness/` talk to the ship through `acp-call.sh`, which sends
one ACP request through `click`. For a fresh ship, use the
[README instructions](../README.md#build-and-install).

## Local checks

```sh
node --test acp/browser-client.test.mjs
node --test acp/hand-client.test.mjs
node --test tests-js/modules.test.mjs
just build
node --test tests-js/distribution.test.mjs
```

Frontend tests cover client state and interface behavior. Module checks enforce
dependency boundaries. Distribution checks inspect assembled agents, imports
and test isolation.

An artifact check does not replace a cold installation and real Gall
compilation.

## Native tests

In Dojo on a development desk:

```text
-test /=harness=/tests
```

Full-agent reload, endpoint fixtures and the 32K-document benchmark live in
`tests-integration` and are excluded from the default assembled desk. To include
them, build with:

```sh
just heavy=true install /path/to/test-pier/harness
```

Commit the mounted desk, then run a test, for example:

```text
-test /=harness=/tests-integration/harness-reload
```

Live hosting, turn and read benchmarks, and the reliability soak, refuse to run
without `HARNESS_HEAVY_TESTS=1`. This opt-in does not impose a disk quota: choose
and monitor a dedicated test ship explicitly. Offline Node tests need no opt-in.

For runtime performance characteristics and benchmark instructions, see
[performance](performance.md).

## Live conformance

Use disposable test ships. Read a fixture's header and environment options
before running it: some tests change defaults, permissions, profile fields or
storage; some suspend agents; some make paid provider calls or leave native
messages and durable audit records.

The common invocation is:

```sh
SHIP_URL=http://localhost:8081 SHIP_COOKIE=/path/to/auth-cookie.txt \
  node tests-js/conformance.mjs
```

Keep cookie files private, use unique fixtures, and run conflicting settings
tests separately. Cleanup cannot erase remote messages or retained audit records.

### Practical goal acceptance

`tests-js/work-goal-practical.mjs` gives one supply-planning request to a real
agent through a file-backed hand. Two local development ships use their
configured HTTPS model providers and real HTTP tools. The runner serves input
data, not model responses: confirmed prices remain unavailable until a future
time. Agents must create and complete the home project's jobs, get a mutually
trusted peer to independently check the work, and arrange a one-time scheduled
agent to deliver the final recommendation without another user prompt.

```sh
SHIP_URL=http://127.0.0.1:8092 SHIP_COOKIE=/private/home.cookie \
WORK_GOAL_REAL_MODELS=1 \
WORK_GOAL_PEER_URL=http://127.0.0.1:8093 \
WORK_GOAL_PEER_COOKIE=/private/peer.cookie \
WORK_GOAL_HOME_SHIP='~home-ship' WORK_GOAL_PEER_SHIP='~peer-ship' \
  node tests-js/work-goal-practical.mjs
```

Use actual ship names and a pair without an existing peer conversation.
To reuse test-owned history, set `WORK_GOAL_PREVIOUS_REPORT`; the runner checks
matching ships and unchanged inputs, then measures new work against that baseline.
It preserves history and token accounting.

`WORK_GOAL_HOME_MODEL` selects a model for the coordinator and scheduled worker,
leaving defaults and the peer model unchanged. Reports identify the models;
keep failed runs alongside successful comparisons.

This test makes paid calls and temporarily grants Workspace, Peers, and Curl in
both directions. It requires fresh discovery responses before starting. Do not
edit trust concurrently. Cleanup restores grants, disables the hand, and cancels
test schedules and executions; conversations, work records, and evidence remain.

The quote opens ten minutes after setup, leaving time for real model latency;
`WORK_GOAL_QUOTE_DELAY_MS` accepts 60,000–600,000 milliseconds. The request gives
an explicit follow-up window, and the runner stops after eight further minutes.
Signals cancel the fixture's work and preserve its evidence. The independent
oracle checks the initial total, final quantities, shipping and budget shortfall.
Acceptance requires one delegation without resending, authenticated peer task
ownership, a scheduled worker starting within two minutes of quote release,
completed tasks, delivered output, and no internal IDs in human replies.
The runner supplies no task updates, model answers, or manual schedule triggers.

The request names the peer, specifies three deliverables, and asks for a timed
follow-up. This tests executing that plan, not discovering collaborators or
decomposing a vague goal. A pass applies to the recorded model pair and workflow.
Inspect both messages against the sources: the numeric oracle does not check
every prose claim.

| Boundary | Fixtures |
| --- | --- |
| ACP and sessions | `conformance.mjs`, `conversations-conformance.mjs`, `session-history-conformance.mjs` |
| Work inbox | Read-only `inbox-conformance.mjs`; native `/tests/harness-inbox` and `/tests-integration/harness-inbox` (see [inbox](inbox.md)) |
| Project access | `project-client-conformance.mjs`; native `/tests/harness-workspace-maintainer`, `/tests/harness-project-client`, `/tests-integration/harness-project-client` (see [project access](project-access.md)) |
| Request to reviewed reply | `social-workflow-conformance.mjs`: owner-directed local workflow with synthetic model and delivery sink (see [workflow and limits](social-workflow.md)) |
| Human work controls | `work-control-conformance.mjs`: text-only hand authority, exact previews, task creation, native Notes review, and model-text non-execution (see [conversation work management](work-control.md)) |
| Commands and settlement | `command-conformance.mjs`, `cancellation-conformance.mjs`, `settlement-conformance.mjs` |
| Conversation hands | `hand-conformance.mjs`, `hand-operations-conformance.mjs` |
| Context and recall | `compaction-conformance.mjs`, `lcm-conformance.mjs` |
| Provider authentication | `openai-auth-conformance.mjs` |
| Resource grants | `clay-scopes-conformance.mjs`, `mcp-scopes-conformance.mjs`, `rehearsal-conformance.mjs`, `owner-grants-conformance.mjs` |
| HTTP and search | `fetch-conformance.mjs`, `curl-conformance.mjs`, `searxng-conformance.mjs` |
| JavaScript | `js-conformance.mjs` |
| Peer work | `peers-conformance.mjs`, `peer-rpc-conformance.mjs`, `peer-tool-client-conformance.mjs` |
| Sustained operation | `reliability-soak.mjs` (local-only; application reads by default, bounded synthetic work opt-in) |
| Tlon | See the [Tlon testing reference](tlon.md#testing) and feature-specific fixtures |

`acp-subscription-conformance.mjs` needs `navigator.locks`, which Node 22 lacks; Node 26 works.

Script filenames in the table are under `tests-js/`; native and browser tests
show their own paths.

See [sustained operation and recovery](reliability.md) for workload bounds,
fault coverage, interrupted-run evidence and the separate cold-start/restart
checks. Run `node --test tests-js/reliability.test.mjs` without a ship.
`conformance.mjs` uses ship-configured inference, or a local provider with
`CONTROLLED_MODEL=1`, and checks independent clients, admission and session behavior. It is not a complete installation or ACP
specification-conformance suite.

Hand conformance uses real inference, or a local provider with `CONTROLLED_MODEL=1`,
with simulated external publication; it is not a Tlon connector test. Hand operations conformance uses a local model fixture
and fixture destinations for recovery, export and retirement.

Context fixtures use local deterministic providers and temporarily select
summary settings. Run them alone. The
[context reference](context-and-memory.md#verification) distinguishes those
checks from the paid-provider smoke test.

## Measure the right boundary

Measure prompt admission, provider completion and external publication separately.
For responsiveness, also inspect maximum event-loop work, replay cost, loom
growth, idle traffic and behavior under concurrent sessions. An asynchronous
request does not make Hoon CPU work preemptible.

`tests-js/performance-read-benchmark.mjs` performs read-only timings through the
browser transport, including idle request counts. Supply `SHIP_URL` and
`SHIP_COOKIE`. Optional `BENCH_BASE=<git revision>` compares that revision's
client with the worktree in both execution orders. It sends no prompts or
configuration writes and closes temporary ACP connections.

Record hardware, runtime, dataset, and warm/cold conditions. The native corpus
benchmark measures index construction and queries separately; use live tests
for end-to-end responsiveness and external results.
