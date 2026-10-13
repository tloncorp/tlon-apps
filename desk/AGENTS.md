# AGENTS.md — the %groups desk

The Hoon backend for Tlon Messenger, installed on every user's ship. Code here
runs on two sides at once: the user's own ship, talking to the client over
Eyre, and remote ships (group hosts, DM peers), talking over Ames. Either side
may be a release behind.

Read before changing an agent: `docs/backend/desk/app/<agent>.md`, where one
exists. Aqua docs:
`docs/backend/aqua/`. Tools: `docs/backend/tools/`. N-1 client policy:
`docs/tlon-apps/desk-compatibility.md`.

General Hoon and Gall guidance lives in
[tloncorp/hoon-reference](https://github.com/tloncorp/hoon-reference), which is
drawn from this desk (a local checkout is often at `~/Projects/hoon-reference`).
Read `fundamentals.md` and `syntax.md` before reading Hoon, and
`architecture.md` and `patterns.md` before writing or changing an agent. This
file holds what is specific to this desk and what reviewers here keep
correcting. Where the two differ, this file wins:

- Log through `lib/logs.hoon` (below), not with the reference's `slog` and
  `~&` examples.
- The established agents (`%groups`, `%channels`, `%chat`, `%activity`) keep
  their `state-N` types in the app file; newer ones (`%notes`, `%buckets`)
  keep them in `sur/` as the reference suggests. Follow the agent you are
  editing.

## Layout and ownership

- `desk/` holds only our sources. Base-dev, landscape and mcp files (`dbug`,
  `default-agent`, `server`, `docket`, `mip`, `json`, …) are vendored by peru
  into the gitignored `desk-deps/` (revs pinned in `peru.yaml`; to build
  against a different kernel, change the rev there on your branch). A fresh
  checkout is *meant* to lack them; never commit them. `desk/lib/verb.hoon` is
  a deliberate local patch and stays committed; do not add patched or
  repo-owned files to the peru pick lists.
- `%groups` is both group server (`+se-core`) and client (`+go-core`, and
  `+fi-core` for groups not yet joined) in one agent. `%channels-server` hosts
  channels; `%channels` is the subscriber side. `%chat` owns DMs and clubs,
  `%activity` unreads and notifications, `%contacts` profiles. Also `%steward`,
  `%buckets`, `%notes`, `%reel`/`%bait` (invites), `%lanyard`/`%verifier`
  (identity), `%presence`. Agents started on install are listed in `desk.bill`.
- Put static assets and UI an agent serves under `app/<agent>/`, not `lib/`
  (`lib/` implies a reusable library). Reuse existing threads and libraries
  (`ted/group/create-1.hoon`, `lib/subscriber.hoon`, zuse's `+moon:title`,
  `sein:title`) rather than reimplementing them.

## Protocol surface: what clients and remote ships depend on

- Types: `sur/<x>-ver.hoon` holds frozen version arms (`v9`, `v10`, …). The
  newest arm aliases the bare sur (`++  v10  c` in `sur/channels-ver.hoon`).
  `lib/<x>-conv.hoon` converts current types down for old paths and marks.
  Note in `*-ver.hoon` *why* each version changed.
- Marks are versioned files under `mar/<agent>/` pinned to one version arm
  (`mar/channel/response-5.hoon` is `%channel-response-5`; a module's marks are
  named agent + module + version, `%steward-gateway-action-1`).
  `lib/rail.hoon` is generated from all desk marks
  (`*=groups=/lib/rail/hoon +groups!rail`); regenerate it when adding a mark.
- `lib/discipline.hoon` wraps groups, channels, channels-server, chat and
  presence. Its `strict-marks` list holds marks whose type is checked on every reload (a changed
  type crashes `+on-load`), and maps each watch/scry path to the marks it may
  emit. Discipline is about mark *types*; `lib/negotiate.hoon` is about
  *protocol versions* between ships. They are different mechanisms.
- **Strict marks stay strict.** A mark that was ever strict and is used
  outside the agent (by the client, or another ship) is never relaxed. A new
  variant means a new mark version. New marks start strict, never with a
  "make strict later" TODO. Relaxed marks are only for marks shielded by
  `lib/negotiate`. Never work around a discipline crash.
- Version only what others use. Agent-to-agent marks within the desk, logs
  infrastructure and negotiate-shielded types can stay unversioned.
- Paths are versioned by prefix (`/v3/groups`, `/x/v2/ui/groups/…`). Old
  prefixes stay served, usually converted from current state. Cross-agent
  subscriptions such as `/v1/groups` are shared firehoses that `%channels`,
  `%channels-server` and `%reel` cast without checking: a new fact variant on a
  shared path breaks every consumer, so it needs a new path prefix.
- `agent:neg` gates ship-to-ship pokes and watches on protocol versions
  (`~.groups^%3`, `~.channels^%4`, …). A bump cuts off every peer still on the
  old version, so it is a fleet-wide break: ship it a release ahead, alone.
- Ames orders messages per flow only. Never assume a poke arrives before a
  watch, or a response before a fact on another wire. Don't put ids in wires
  just to tell them apart: each distinct wire is a new flow, which loses
  ordering.
- The client's view of the desk is `packages/api/src/client/requests/`
  (every scry, subscribe and poke, with the desk version that first served
  it). Grep it before changing or removing a path or mark. Over HTTP the care
  is stripped, so the client scries `/groups/...`, not `/x/groups/...`.
- The client subscribes to firehoses and filters locally; we do not run
  per-entity subscriptions. New domain data the client needs at startup rides
  in the versioned init payload (`/vNN/init`), not a separate startup scry.

## Building new backend code

- Agent shape (`app/groups.hoon`, `app/steward.hoon`):
  - `=|  current-state` with **no face**, then `=*  state  -`, `%-  agent:dbug`,
    and `%^  verb  |  %warn` (verb takes three arguments).
  - `=<` puts the agent door (only the ten gall arms, each delegating via
    `cor`) over a `|_  [=bowl:gall cards=(list card)]` helper core holding all
    logic. Wrap with `discipline` and `agent:neg` if the agent has a wire
    protocol.
  - Narrowing a state field (`?>  ?=(^ owner)`) changes the core type and can
    fight `^+  cor`. Narrow a local (`=/  own  owner  ?~  own  cor`) when the
    branch keeps mutating state; narrowing that returns immediately is fine.
    Assigning a narrowed local back to a state field, re-wrap it to keep the
    declared type (``=.  last-id  `u.mkey``).
- State and migrations:
  - Tag every state `[%N …]` and keep every historical `state-N` type
    verbatim (they describe bytes already on disk). For repetition, use `%*`
    against a *past* state, not the current one.
  - `+load` is a `=?  old  ?=(%N -.old)` chain, one version at a time, ending
    in `?>` on the latest. Any change to a state type needs a migration. Don't
    keep intermediate "in-flight" versions; convert straight to the latest.
  - Migrations needing side effects return cards; deferrable work goes through
    a `/load/<name>` behn `%wait now`. Never scry in `+on-load` or in `%kick`
    handling: `negotiate` can simulate kicks during load.
  - `+on-save`'s shape is part of the contract; `+load` unpacks exactly it.
  - Upgrade old pokes to the newest action version and handle only that,
    rather than keeping parallel handlers per version.
- Types: shared protocol types (actions, updates, responses) go in `sur/` with
  bare names and version arms (`action:v1:gs`); don't carry mark numbers into
  type names. Keep field names short; the aura says what a timestamp is
  (`@da`), so no `-at` suffix.
- Marks: JSON for `@da`/`@dr`/`@p` uses `scot`/`se` pairs, not `numb`/`ni`.
  Tagged unions use `of` outside and `ot` per variant; single-key objects use
  `frond`.
- Permissions: every poke, watch and HTTP entry point checks the caller.
  Local-only arms assert `=(our src):bowl`; server arms check that `src.bowl`
  may see the context (member, host, admin, not banned). A client feature flag
  is not a defence.
- Performance: `=/` is eager, so a scry bound before the branch that needs it
  runs on every event (every post, on every ship). Don't scry once per
  subscriber; use the cached sets (`/channels/can-read`). Derive structurally
  where you can.
- Resubscribe on `%kick` with a delay, never a tight re-watch loop: `subscribe`
  in `lib/subscriber.hoon` retries every 30 seconds, and `%groups` has its own
  `+safe-watch`.
- Logging and errors: use `lib/logs.hoon` with a volume. `+fail` for every
  crash, local or remote (poke-nack, watch-nack): remote crashes never reach
  the host's `+on-fail`, so we log them locally. `+tell` for events. Never
  commit `~&` or `slog`. Don't disguise a crash as a permission-denied
  response. A `.^` crash cannot be caught in userspace; check existence with a
  `%u` scry first. Timer `%wake` errors go to `+on-fail`.
- Fix root causes. Don't add automatic recovery for a failure nobody has
  observed or explained; ship instrumentation and manual recovery until the
  cause is known. Don't invent gall or Ames failure modes: if a diagnosis
  rests on how the kernel behaves, verify it in the urbit source.
- Version a spider thread by copying it with a version tag (`create-1`), not by
  matching on types at runtime.
- A new agent needs a spec at `docs/backend/desk/app/<agent>.md` (purpose,
  poke/watch/scry surface, state model, lifecycle and invariants) and an entry
  in `desk.bill` if it should run on install.

## Hoon style

Formatting, indentation and idiom follow hoon-reference (`fundamentals.md`
"Formatting Conventions", `patterns.md`). These are the points reviewers here
correct most often. Models imitate the code around them, so every deviation
that lands gets copied. Fix small style deviations rather than accepting them.

- Comments: arm and type docs are `+arm: brief description` /
  `$type: brief description`, then a blank `::` line, then lowercase prose.
  Code-segment comments are `::` lines above the code. No markdown, no banners
  or separator rules, no capitalised tutorial prose, no planning notes or
  history, no comments on self-explanatory code, no hand-written JSON-shape
  comments in marks. A comment must describe what the code actually does.
- Use `&` and `|`, not `%.y` and `%.n`. Use `bind:m` unaliased. Alias with
  `=*` rather than copying. Filter maps with `murn ~(tap by …)` and `gas:by`.
  Use standard faces (`=ship`, `=bowl:gall`). Drop casts that the rail or the
  types already make unnecessary. Unwrap a vase with its full type, then narrow.
- Name helper cores consonant-vowel (`go-core`, `se-core`, `ca-core`). Put
  flags and ids first in argument lists, and keep argument order consistent
  across agents.

## Tests

- Agent tests: `tests/app/<agent>.hoon` with `/+  *test-agent`, monadic `;<`
  style (`eval-mare`, `do-init`, `do-poke`, `do-agent`, `do-arvo`). Set the
  bowl before `do-init` so `our.bowl` is right when `on-init` subscribes. Mock
  scries with `set-scry-gate`; agents subscribing to `%activity` need at least
  `&` for `[%gu @ %activity @ %$ ~]`. Assert with `ex-equal` and friends, not
  `?>`.
- Multi-ship flows: aqua tests in `tests/ph/` (see `docs/backend/aqua/`).
  Prefer them for behavior that crosses ships; `test-agent` move ordering
  differs from real gall.
- Tests must assert behavior the agent really produces. Reviewers do not
  re-verify generated tests; the author is responsible for them doing what
  they claim. No agent instructions or decorative headers in test files.

## Validating a change (agents with a ship)

Never claim a desk change compiles without building it.

1. `./scripts/sync-deps.sh` once per checkout, then
   `./scripts/assemble-desk.sh <pier>/groups`. Never hand-copy or hand-edit
   files in a mounted desk; fix stale clay files with `|rm`, or `|unmount` and
   `|mount`, then re-assemble.
2. `|commit %groups`; wait for any `sync` spinner; confirm no build errors.
3. `-build-file` every changed Hoon file a live app or mark might not reach,
   e.g. `=aut -build-file /=groups=/sur/steward/automation/hoon`. A Dojo
   expression is not a substitute for building the repository file.
4. Run the affected tests: `-test /=groups=/tests/app/<agent>`;
   `backend/run-tests.sh` runs everything, including aqua.

Report the `|commit`, `-build-file` and test results when claiming
validation. If the urbit and vere sources are checked out locally (often
`~/Projects/urbit`, `~/Projects/vere`), read kernel code at the rev pinned in
`peru.yaml` (`git -C ~/Projects/urbit show <rev>:pkg/arvo/sys/lull.hoon`), not
whatever branch is checked out. `desk-deps/` holds the vendored copies.

Developer tools (aqua patching, pill and moon scripts) live in `backend/`.

When told to drive a ship through tmux, use `tmux send-keys` and
`capture-pane` against its session without switching to it; `%` confirms the
connection. Otherwise prefer the urbit MCP tools.

## Code Review Rules

A reviewer may have no compiler, ship or urbit source. CI commits the desk and
runs the agent and aqua tests, which builds every agent and everything they or
the tests import, so spend attention on what a build cannot catch.

Flag:

1. **Wire compatibility.** Any change to the type of an existing mark, to an
   existing arm in `sur/*-ver.hoon`, or to the fact or scry shape of an
   existing path. Older clients and remote ships still use them; the fix is a
   new version, never an edit. Also a removed path or mark still listed in
   `packages/api/src/client/requests/`.
2. **Shared paths.** A new fact variant on an existing subscription path.
3. **Discipline.** Relaxing a strict mark, removing one from `strict-marks`, or emitting a mark not declared for that path.
4. **Negotiation.** Any protocol-version bump, especially alongside unrelated
   changes.
5. **State.** A state type change without a new `state-N`, migration arm and
   `=?` line; edits to an old `state-N`; a migration that crashes on data old
   ships may legitimately hold, or that fails to preserve existing data and
   seed new fields; state changed with `=.` but never written back.
6. **Permissions.** A poke or watch reachable by a foreign ship
   (`src.bowl` ≠ `our.bowl`) that doesn't check `src.bowl`, or a server arm
   that sends data to non-members. Name the foreign path: Eyre, spider and
   dojo entry points need the ship's own auth and run as `our`, so they are
   not an attack surface.
7. **Hot-path cost.** A scry bound eagerly on a per-event path, or work done
   once per subscriber.
8. **Subscriptions.** A `%kick` that neither resubscribes (with delay) nor
   deliberately drops; a negative watch-ack that can crash-loop; logic that
   assumes ordering across wires.
9. **Client contract.** The client relying on a new path or mark before a
   desk release serves it (see `docs/tlon-apps/desk-compatibility.md`).
10. **Errors and logs.** Committed `~&`/`slog`, a crash path not reported with
    `+fail`, or recovery logic for an unexplained failure.
11. **Style.** Deviations from the Hoon style section above, especially
    LLM-style comments (markdown, banners, prose that doesn't match the code).
    Label these low priority, but do raise them: they get copied.

Do not flag:

- Files "missing" from `desk/lib`, `desk/sur` or `desk/mar` that peru
  provides (`dbug`, `default-agent`, `server`, `docket`, `json`, …).
- Type errors, nest-fails or unresolved faces in agents, marks or anything
  they import; CI builds those. Don't claim a file fails to build unless you
  can name the failing expression and the types involved. Do flag a new `sur`
  or `lib` file that nothing imports yet: CI never builds it.
- Aqua test conventions (`tests/ph/`, `lib/ph/`, `ted/ph/`): scry paths carry
  two marks (the inner vane's and aqua's outer `%noun`), and the fleet is
  virtual, so real-network Ames timing doesn't apply.
- Regenerated `lib/rail.hoon` changes that match added or removed marks.
- Retired stub agents (`app/diary.hoon`, `app/heap.hoon`) having no logic.
- Unversioned internal agent-to-agent marks.
