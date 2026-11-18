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
| `just fetch` | Copies the files listed in `desk-deps.yaml` into `desk-deps/`, and checks `%mcp` out into `mcp/` |
| `just build` | Runs `fetch`, then lays `desk-deps/` and `desk/` into `desk-out/` |
| `just install-dev DESK` | Runs `build`, then copies `desk-out/` into a mounted desk |
| `just install DESK` | Runs `build`, then replaces a mounted desk with `desk-out/`, deleting everything else there |
| `just commit DESK` | Runs `install-dev`, then asks the running ship to commit that desk |
| `just push SHIP [DESK]` | Runs `build`, then copies `desk-out/` into a running fake ship's mounted desk, `harness` by default, and commits it |
| `just fake-dev [SHIP] [OWNER]` | Boots a fake ship in a container, installs `%mcp` and `%harness` and runs `setup` |
| `just fake-remove` | Removes the fake ships of a network, its holder container and its volume of piers |
| `just test [PATTERN]` | Runs `test-hoon`, then `test-js`, and fails if either fails |
| `just test-hoon [PATTERN]` | Runs the native Hoon tests on fake `~zod`: all of them on a fresh ship, or those matching the regex on a kept one |
| `just test-js [PATTERN]` | Runs the JavaScript tests that need no credentials: the `node --test` files, then the live scripts on fake ships, fresh or kept as above |
| `just setup SHIP OWNER` | Sets the owner, enables the Tlon hand and turns on Context Lens sync |
| `just provider SHIP NAME [MODEL]` | Connects a model provider and makes it the default |
| `just clean` | Removes `desk-out/` |
| `just distclean` | Also removes `desk-deps/`, `.deps-cache/`, `mcp/`, `.test-run/` and the checkout's fake ship images |

`install-dev`, `install` and `commit` take a desk mounted in a pier on this machine.
`push`, `setup` and `provider` take a fake ship, as `~zod`, running in a container;
`just click=scripts/click setup PIER OWNER` gives `setup` or `provider` a pier on this
machine instead.

This desk imports files it does not own, listed in `desk-deps.yaml` and
fetched by the tlon-apps `scripts/backend/fetch-deps.sh`. The standard libraries and
marks come from `urbit/urbit` at a pinned commit. The Tlon protocol types are
copied from the tlon-apps `desk/`, so they always match the Groups desk in the
same checkout. `just fetch` also checks the whole `%mcp` repository out into
`mcp/`, at the commit the tlon-apps `desk-deps.yaml` pins for `mcp`.

`just install-dev` uses `rsync` without `--delete`, so development files in the
mount survive, and so do files this desk no longer contains. `just install` removes
those: it deletes every file in the mount that the build did not produce,
`tests-integration/` included unless `heavy=true` is set.

`just commit` uses `scripts/click`, Tlon's `click` with the command passed on stdin
so credentials stay out of process arguments. It needs a running pier and `socat`.
The receipt confirms that Hood accepted the commit request; Gall recompilation and
native tests remain separate checks. The socket path `PIER/.urb/conn.sock` must be
under 108 bytes on Linux and 104 on macOS, so reach deep piers through a short
symlink.

## Fake ships

`just fake-dev`, `just push`, `just setup`, `just provider` and the test recipes run
fake ships in containers, from the image `fakeship:<N>` that the repository's
`scripts/backend/container/` builds, where the number N stands for the checkout, with vere and the boot pill in it (see
[the fake ship image](../../../docs/backend/tools/README.md#fake-ship-image)). They use
podman when it is usable and docker otherwise; set `CONTAINER_RUNTIME` to choose.
`just fake-dev`, `just setup` and `just provider` also need `jq`, and `just provider`
`curl`. This is verified on Linux with podman; macOS is untested.

`just fake-dev` runs `scripts/setup-fake-dev.sh`, which needs `mcp/` from
`just fetch`. The names below carry a number, written `<N>`, that stands for the
checkout, so each checkout has its own ships. Each ship runs in its own container,
`fake-dev-<N>-zod` for `~zod`, with its pier in the volume `fake-dev-<N>-piers`, and
the repository mounted read-only. The ships of a network share the network namespace
of a holder container, `fake-dev-<N>`, so they reach each other on its loopback. A
ship serves HTTP on the network's port 9090 unless `HTTP_PORT` is set, so a second
ship needs another port from 9090 to 9099, as in `HTTP_PORT=9091 just fake-dev '~nec'`.
The holder publishes each of those ports on a free port of the host's 127.0.0.1,
which `fake-dev` prints as the ship's web URL and `podman port fake-dev-<N>` lists.
`FAKE_NET` names another network, with its own holder, containers and volume, and
`FAKE_NET_PORTS` its range of ports, which applies when its holder is created. A
ship in a container cannot reach a server on the host's own loopback.

`fake-dev` refuses a ship whose container is running or which already has a pier in
the volume. When the ship is up, it prints the ship's web URL, its login code and
these commands, which run from `packages/harness` and name the ship without its `~`,
which zsh would expand (with docker in place of podman, if that is the runtime):

```sh
podman logs -f fake-dev-<N>-zod                 # the ship's output
scripts/ship-click -p zod '(add 2 2)'           # evaluate Hoon, as in Dojo
scripts/ship-click -i - -kp zod < thread.hoon   # run a thread
just push zod                                   # build desk/ and commit it as %harness
just provider zod chatgpt
podman stop fake-dev-<N>-zod                    # podman start resumes it
just fake-remove                                # every ship of the network, its holder and volume
```

`scripts/ship-click` takes `scripts/click`'s options and runs it in the ship's
container, so the host needs neither urbit nor `socat`. A path it is given, such as
`-i FILE`, is read inside the container, so give a thread on stdin. Set `FAKE_NET`
for a ship on another network.

Scripts in `scripts/harness/` talk to the ship through `acp-call.sh`, which sends
one ACP request through `click`. For a fresh ship, use the
[README instructions](../README.md#build-and-install).

## Test suites

`just test-hoon` runs `scripts/test-hoon.sh`: the native tests and integration tests
on `~zod` alone. It boots `~zod` with `just fake-dev` on the network `fake-test-<N>`,
as container `fake-test-<N>-zod`, deploys with `just push`, runs the
tests through `scripts/ship-click` and reads their output from the container's log.
`just test-js` runs `scripts/test-js.sh`: the `node --test` files and the live scripts
on `~zod`, `~lux` and `~nec`, booting `~zod` and `~lux` at the same time. The live
scripts start local servers on 127.0.0.1 that the ships call, so Node and the three
ships run in one container, `fake-test-js-<N>`, from the image `harness-test-js:<N>`
that `scripts/test-js/Dockerfile` builds on `fakeship:<N>`. Neither suite publishes a
port on the host, and every name carries the checkout's number, so checkouts can run
their tests at the same time. On the host the script builds the
desks and the images, starts the container and runs itself in it, so the host needs
no `node`. They are the two CI jobs. Without a pattern, each boots fresh ships and
removes them, so the full `just test` boots `~zod` twice. Each keeps its results, in
`results.txt`, and logs in `.test-run/hoon/` or `.test-run/js/`; `test-js` writes
each ship's output to `.test-run/js/logs/ship-<ship>.log`.

CI splits `test-js` across runners. `TEST_SHARD=I/N just test-js` runs the Ith of N
parts of the full run, on fresh ships. With more than one part, the last takes the
`node --test` files and the scripts restricted to `~lux` and `~nec`, and boots no
`~zod`; the others deal out the `~zod` scripts in turn. A shard takes no PATTERN.
`just test-js --list` prints what a run would take, as `GROUP NAME` lines, without
ships; with `TEST_SHARD`, what that shard would take.

With a PATTERN, the ships stay running and each run deploys the working tree:
`test-hoon` keeps `fake-test-<N>-zod`, its holder `fake-test-<N>` and the volume
`fake-test-<N>-piers`, and `test-js` keeps `fake-test-js-<N>`. A ship one suite keeps
is not shared with the other. Without a PATTERN, each suite refuses to start while
its containers run. `test-js` wipes Harness's agent
state with `|nuke` before each live script, which sets up what it needs; state in
other desks stays. `just test --stop` removes the containers and the volume. Use the
full `just test` before pushing.

`scripts/test-js.sh` gives live scripts their variables: the opt-ins, `CONTROLLED_MODEL=1`,
the ships' piers in `SHIP_PIER` and `PEER_PIER`, which `tests-js/lib/ship-thread.mjs`
runs threads on through `click`, and a `TEST_NEST` channel that `~lux` hosts and `~zod`
has joined, which `tests-js/lib/test-channel.mjs` creates once. Its `skip_reason`
function names the scripts it can't run and why.

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
just heavy=true install-dev /path/to/test-pier/harness
```

Commit the mounted desk, or use `just heavy=true push zod` on a fake ship, which
commits it, then run a test, for example:

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
