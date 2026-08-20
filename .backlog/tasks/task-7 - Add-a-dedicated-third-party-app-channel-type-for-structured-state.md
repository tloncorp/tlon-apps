---
id: TASK-7
title: Add a dedicated third-party app channel type for structured state
status: Done
assignee:
  - '@james@tlon.io'
created_date: '2026-08-19 13:47'
updated_date: '2026-08-20 13:50'
labels:
  - workspaces
  - platform
  - hoon
milestone: m-3
dependencies: []
references:
  - PLAN.md
  - desk/app/groups.hoon
  - packages/shared/src/store/channelActions.ts
  - desk/app/notes.hoon
  - desk/app/kits.hoon
  - desk/sur/groups.hoon
  - docs/tlon-apps/interactive-surfaces.md
  - docs/tlon-apps/channel-views.md
priority: low
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: the backend already supports third-party channel agents via generic channel-host routing (desk/app/groups.hoon), and Notes demonstrates the pattern while inheriting group permissions (packages/shared/src/store/channelActions.ts). The platform milestone calls for a dedicated app channel type so a mini-app can have its own data model where Notes is insufficient, without being forced into chat posts.

Scope is the channel type itself — creation inside a workspace group, permission inheritance, and structured read/write from the client API layer. Kit-defined UI on top of it is covered by the open-renderer-registry task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A workspace group can create an app channel hosted by a third-party channel agent, inheriting group membership and permissions
- [x] #2 Client API layer can read and write structured state to the channel
- [x] #3 A non-member cannot read or write the channel state
- [x] #4 Agent (Hoon) tests cover channel creation, permission checks, and state round-trip
- [x] #5 docs/ describes the channel contract for third-party channel agents
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

Three decisions need you — §3 (state model), §4 (naming), §5 (transport). The rest follows from what is already in the tree.

### 1. The good news: the contract already exists and is specified

`%groups` has a real generic channel-host convention, and `desk/sur/groups.hoon:279-288` names its three pieces:

- **`$channel-join` / `$channel-leave`** (`[nest flag]` / `nest`) — `%groups` pokes `[our.bowl p.nest]`, the agent named by the nest kind, with marks `group-channel-join` / `group-channel-leave`. See `+join-channels` / `+leave-channels` (`groups.hoon:3515-3550`).
- **`/joined/<host>/<name>`** — the host agent answers a `%gu` scry with a loob. `+is-joined` (`groups.hoon:650-663`) guards on agent liveness first (`%gu /$`) so an uninstalled backing agent reads as not-joined rather than crashing the scry.
- **`$channel-active`** (`[flag nest joined=?]`, mark `group-channel-active`) — the host pokes `%groups` back to keep `$active-channels` current (`groups.hoon:488-493`).

`%notes` implements all three: `notes.hoon:206-228` for the two pokes, `:752` for the `[%u %joined host=@ name=@ ~]` scry arm, `+no-report-active` at `:2637` for the report. So this task is not "design a channel-host protocol" — it is "write a second implementation of one, and open the client type to match."

**Permission inheritance is also already solved, and copyable.** `+group-can-read` (`notes.hoon:1014-1039`) scries our *local* `%groups` replica for the bulk `can-read` **gate** at `/v2/groups/<ship>/<name>/channels/can-read/noun` and applies it to `[ship nest]`. Two details in that code are load-bearing and worth porting verbatim rather than rediscovering:

- It is `%gx`, not `%gu` — `%groups` only serves `%x` peeks.
- It short-circuits for the channel's **own host**, not for `our.bowl`. On a subscriber, `our.bowl` is the local reader and must still be checked, or a revoked subscriber keeps access.
- `+group-synced` (`:1043`) distinguishes a real revocation (group present, `can-read` now false) from a replication gap (group not yet synced). Without it, a not-yet-replicated group looks like a revocation and drops the channel.

That is AC #1 and AC #3 in ~30 lines of Hoon, already proven in `%notes`.

### 2. The client-side blast radius, measured rather than estimated

I said in TASK-6 that `channel.type` has 165 references across 54 files. That is the reference count, not the change size, and I want to correct the impression it gives.

I added `| 'app'` to `ChannelType` and typechecked api, shared, app, and ui. **Two compile errors, both in the same file:** `layoutTypeFromChannel` (`PostCollectionConfiguration.ts:24`) and `configurationFromChannel` (`:169`) — the only exhaustive switches with no default. Everything else uses `===` comparisons or already defaults.

For calibration, the commit that added `'notes'` (`f4e543212c`) touched 17 files / +274 lines — and that was with `%notes` already written.

The real cost is **runtime**, not compile-time. Four sites take a wrong branch silently for a new type:

| site | today | needs |
|---|---|---|
| `getChannelKindFromType` (`urbit/utils.ts:171`) | if-chain, `else return 'chat'` | an arm, or an app channel gets a `chat/` nest |
| `getChannelType` (`:147`) | if-chain, `else return 'chat'` | an arm, or the nest reads back as a chat channel |
| `CHANNELS_BACKED_KINDS` (`:126`) | `['chat','diary','heap']` | nothing — the new kind is correctly third-party by omission |
| `channelContentConfigurationForChannelType` (`channelActions.ts:255-285`) | switch, then `throw new Error('Unknown channel type')` | an arm, or channel creation throws |

Plus the presentation arms `'notes'` already has, which a new type wants for parity: `getChannelTypeIcon` (`channelUtils.tsx:250`), `fallbackRendererIdForChannelType` (`PostCollectionView.tsx:25`), `ChannelHeader.getChannelTypeName` (`:173`).

One thing TASK-6 already removed from this list: `PostView`'s switch now has a `default`, so it no longer forces an arm.

### 3. Decision one — what "structured state" is

The AC says "read and write structured state." Three shapes, and this is the substantive choice:

- **(i) One opaque JSON document per channel, with a revision.** The channel holds `{revision, state, processedActionIds}`. Reads return the document; writes are actions checked against an `expectedRevision`. This is **TASK-3's interactive-surface protocol lifted off the post and onto the channel** — same revision/conflict/idempotency semantics, already specified in `docs/tlon-apps/interactive-surfaces.md` and already mirrored on `%notes`' `expected-revision`. `state` stays opaque for the same reason it does there: typing it couples the protocol to whichever kit owns the surface.
- **(ii) A keyed collection** — `map entry-id → JSON`, per-entry revisions. A closer analogue to a real data model, and to how `%notes` holds notes. More agent surface (create/update/delete/list per entry), and it invents a record model no kit has asked for yet.
- **(iii) An append-only action log with derived state.** The mini-app demo's reducer model, and what TASK-21 ("action replay, snapshots, upgrade, recovery") explicitly owns.

**I recommend (i).** It is the smallest thing that satisfies "its own data model, not chat posts"; it reuses semantics that are written down, reviewed, and tested rather than inventing a second concurrency story; and a single JSON document can hold a list, so (ii) buys granularity nothing needs yet. (iii) is a different task by name.

Worth stating the consequence: with (i), two concurrent writers to the same channel serialize through the revision check, and the loser is told to look again. That is the same trade TASK-3 documented, and it is fine for a shared household workspace. If an app needs per-record concurrency, that is the upgrade to (ii) and it is additive.

### 4. Decision two — naming

The channel-host convention makes the **nest kind the agent name**, so those two must agree. The client `ChannelType` member is free (`getChannelKindFromType` already maps `notebook`→`diary`, `gallery`→`heap`).

The name is product-facing: it shows up in `ChannelHeader.getChannelTypeName`, the create-channel sheet, and the channel-type icon. My suggestion is agent/kind `%apps` with `ChannelType: 'app'`, giving nests like `apps/~zod/meal-plan`. `%surfaces` is the other candidate and reads better against TASK-3's vocabulary, but it invites confusion with interactive surfaces on posts, which are a different thing. **Your call on the name** — it is cheap now and annoying later.

### 5. Decision three — transport

Two precedents in this repo, and they differ by an order of magnitude:

- **`%notes`** serves a v1 **HTTP API** through `+serve-http` (`notes.hoon:745+`), because it also serves a PWA and static assets. 3088 lines total.
- **`%kits`** uses plain **poke / scry / subscribe**, and `packages/api/src/client/kitsApi.ts` talks to it with the existing `poke`/`scry`/`subscribe` helpers from `./urbit`. 264 lines of Hoon, 111 of `sur`, 204 of json lib, 278 of test.

**I recommend the `%kits` shape.** `%kits` is the right size analogue, it is recent work on this branch so its conventions already match CLAUDE.md's agent guidance, and the client helpers exist. An HTTP API here would be building a second transport for no reason.

### 6. Work

**a. `desk/sur/apps.hoon`** — `$state` (revision, opaque `@t` JSON, processed action ids), `$action` (`%create`, `%write` with `expected-revision`, `%delete`), `$update`. Per CLAUDE.md: bare type names with `v1` version arms; state types live in the app file, only shared protocol types in `sur/`.

**b. `desk/lib/apps-json.hoon`** — JSON encode/decode. `scot`/`se` pairs for `@da`/`@p`, `of` + `ot` for the tagged action union, `frond` for single-key objects.

**c. `desk/mar/apps/action-1.hoon`, `update-1.hoon`** — marks `%apps-action-1` / `%apps-update-1`.

**d. `desk/app/apps.hoon`** — the `=<` + helper core pattern, `=| versioned-state` with no face, `%^ verb | %warn`. Implements:
- the three channel-host arms from §1 (`group-channel-join`, `group-channel-leave`, the `/joined/` scry, the `group-channel-active` report);
- `+group-can-read` and `+group-synced` ported from `%notes`;
- `%write` gated on can-read plus the revision check, returning a conflict on mismatch;
- scries for the current document and a `/v1/updates` subscription path.

**e. `desk/desk.bill`** — register `%apps`. Note in passing: **`%notes` is not in `desk.bill`** (verified — no commit ever added it), so it ships in the desk unbooted. I don't know whether that is deliberate; the new agent should be registered per CLAUDE.md, and I'll flag the `%notes` omission rather than "fixing" it here.

**f. Client** — `ChannelType: 'app'` plus the four required arms and three presentation arms from §2; `createAppChannel` in `channelActions.ts` following `createNotesChannel`'s shape (create via the agent, then `addChannelListingToGroup`, then poll for the listing with rollback on failure — that retry-and-rollback dance at `:145-240` exists because the group listing is eventually consistent, and a new third-party channel has the same problem); `packages/api/src/client/appsApi.ts` modelled on `kitsApi.ts`.

### 7. Tests (AC #4)

`desk/tests/app/apps.hoon`, `/+ *test-agent`, monadic `;<` with `eval-mare`. `desk/tests/app/notes.hoon` is the template and already has exactly the fixtures this needs — `can-read-allow` and `can-read-deny` scry gates at `:638` and `:651`. Set the bowl before `do-init`, and mock scries via `set-scry-gate`.

- **Creation** — `%create` binds the nest to a group; the `/joined/` scry reads true afterward; a `group-channel-active` poke is emitted.
- **Permissions (AC #3)** — with `can-read-deny`, a non-member's read fails closed and a write is rejected. With `can-read-allow` it succeeds. Also the two subtleties from §1: a subscriber's `our.bowl` read is still checked, and an unsynced group is transient rather than a revocation.
- **Round trip (AC #2)** — write, read back, revision incremented by exactly 1; a stale `expected-revision` returns a conflict and changes nothing; a replayed action id is a no-op.
- **Join/leave** — the two `%group-channel-*` pokes from a same-ship source do the right thing for host and subscriber.

Client-side: `appsApi` unit tests in `packages/api`, and a `channelActions` test for `createAppChannel` following the notes-channel tests at `channelActions.test.ts:141+`.

### 8. Docs (AC #5)

`docs/apps.md` for the agent itself (CLAUDE.md requires a spec doc per agent: purpose, poke/watch/scry surface, state model, lifecycle, invariants) — alongside the existing `docs/kits.md` and `docs/steward.md`.

Separately, and this is the AC's actual ask: **`docs/backend/channel-hosts.md`** — the contract a third-party channel agent must implement. That contract is real, load-bearing, and currently written down nowhere; it exists as comments in `groups.hoon` and a working example in `notes.hoon`. Writing it is most of the value of this task for anyone who adds the third one.

### 9. Verification

`pnpm -r tsc`, the api/shared/app vitest suites, prettier, and the desk test. Hoon changes mean the desk must actually build: `./scripts/sync-deps.sh` then `./scripts/assemble-desk.sh` and a `|commit` on a dev ship, per CLAUDE.md's rule that the only supported flow is edit-in-`desk/` → assemble → rsync → commit. Never hand-edit the mounted pier.

Per my worktree notes, single-ship verification from a fresh worktree needs extra setup — I'll check that before promising a live round trip, and say plainly if I only get as far as the desk test.

### 10. What this does not do

- **No UI.** Rendering an app channel is TASK-6's registry: the channel declares a view id in its `contentConfiguration` and degrades to the post list plus the composer notice on a client without the renderer. This task should set a sensible `contentConfiguration` at creation so that path is exercised, but it ships no renderer.
- **No kit-facing declaration.** A kit naming an app place needs the place-vocabulary extension carried to TASK-15 (`placeKindSchema` is `chat|notebook|gallery`, and `desk/app/kits.hoon:256` maps only onto `%channels` kinds — it cannot create a notes channel today either).
- **No action log, snapshots, or replay** — TASK-21.
- **No agent tooling.** Whether the bot can read/write an app channel through the `tlon` CLI is a separate surface; this task delivers the client API layer the AC names.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**The channel-host contract already exists and is fully specified — this task is a second implementation, not a design.** `desk/sur/groups.hoon:279-288` defines `$channel-join` (`[nest flag]`), `$channel-leave` (`nest`), and `$channel-active` (`[flag nest joined]`). `%groups` pokes the agent named by the nest kind (`+join-channels`/`+leave-channels`, `groups.hoon:3515-3550`), reads a `/joined/<host>/<name>` loob scry (`+is-joined`, `:650-663`, guarded on agent liveness via `%gu /$` so an uninstalled backing agent reads as not-joined rather than crashing), and accepts a `group-channel-active` poke back (`:488-493`). Marks exist at `desk/mar/group/channel-{join,leave,active}.hoon`. `%notes` implements all three: `notes.hoon:206-228`, the `[%u %joined host=@ name=@ ~]` arm at `:752`, and `+no-report-active` at `:2637`.

**Permission inheritance is solved and copyable, with three subtleties.** `+group-can-read` (`notes.hoon:1014-1039`) scries the LOCAL `%groups` replica for the bulk `can-read` gate at `/v2/groups/<ship>/<name>/channels/can-read/noun` and applies it to `[ship nest]`. It must be `%gx` — `%groups` only serves `%x` peeks. It short-circuits for the channel's own host, deliberately NOT for `our.bowl`, because on a subscriber `our.bowl` is the local reader and skipping the check would keep a revoked subscriber's access. And `+group-synced` (`:1043`) separates a real revocation from a replication gap, so an unsynced group is transient rather than a drop. `%groups` serves the gate from `go-can-read` (`groups.hoon:4747`, `:4810`).

**The client blast radius, measured.** I added `| 'app'` to `ChannelType` and typechecked api/shared/app/ui: **two** compile errors, both in `PostCollectionConfiguration.ts` (`layoutTypeFromChannel:24`, `configurationFromChannel:169` — the only exhaustive switches without a default). Reverted. So my TASK-6 figure of "165 references across 54 files" is the reference count, not the change size; the `'notes'` commit `f4e543212c` was 17 files / +274 lines with the agent already written.

The real risk is runtime, not compile-time. Silent-wrong-branch sites: `getChannelKindFromType` (`urbit/utils.ts:171`) and `getChannelType` (`:147`) both `else return 'chat'`, so without arms an app channel gets a `chat/` nest and reads back as chat; `channelContentConfigurationForChannelType` (`channelActions.ts:255-285`) is a switch that throws `'Unknown channel type'`. `CHANNELS_BACKED_KINDS` (`:126`) needs nothing — a new kind is third-party by omission. Presentation parity wants `getChannelTypeIcon` (`channelUtils.tsx:250`), `fallbackRendererIdForChannelType` (`PostCollectionView.tsx:25`), `ChannelHeader.getChannelTypeName` (`:173`). TASK-6 already removed `PostView` from this list by giving its switch a `default`.

**Two transport precedents, an order of magnitude apart.** `%notes` is 3088 lines and serves a v1 HTTP API through `+serve-http` because it also serves a PWA. `%kits` is 264 lines of app + 111 sur + 204 json lib + 278 test, and `packages/api/src/client/kitsApi.ts` reaches it with plain `poke`/`scry`/`subscribe` from `./urbit`. `%kits` is the right size analogue and its conventions already match CLAUDE.md's agent section.

**`%notes` is not in `desk/desk.bill`.** Verified by grep and by `git log -S` — no commit ever added it, so it ships in the desk unbooted. Unclear whether that is deliberate. A new agent should be registered per CLAUDE.md; I will flag the `%notes` omission rather than change it here.

**The eventual-consistency dance is not optional.** `createNotesChannel` (`channelActions.ts:145-240`) creates the notebook, then polls `getGroup` up to 5 times at 250ms for the channel listing to appear, with a distinct `NotesChannelListingUnverifiedError` so it can tell "listing definitely missing" from "couldn't read the group", and rolls back both the local insert and the remote notebook on failure. A new third-party channel has exactly the same problem and needs the same shape.

**Test fixtures for AC #3/#4 already exist.** `desk/tests/app/notes.hoon` has `can-read-allow` and `can-read-deny` scry gates at `:638` and `:651`, installed via `set-scry-gate`. `desk/tests/app/kits.hoon` (278 lines) is the smaller structural template.

**Relationship to TASK-3.** `docs/tlon-apps/interactive-surfaces.md` puts revision/conflict/idempotency semantics on a post blob — state travels with the bot's message. TASK-7 is the same semantics with the channel as the store instead, for state that is not a message at all. Recommending state model (i) in the plan reuses that written-down protocol rather than inventing a second concurrency story.

**All three decisions settled.**

1. **State model (i):** one opaque JSON document per channel, carrying a revision — TASK-3's interactive-surface semantics (revision, conflict on stale `expected-revision`, idempotency by action id) with the channel as the store instead of a post blob. `state` stays opaque `@t` JSON so the protocol does not couple to whichever kit owns the surface.
2. **Naming:** agent and nest kind `%apps`, client `ChannelType` member `'app'`. Nests look like `apps/~zod/meal-plan`.
3. **Transport:** the `%kits` shape — poke / scry / subscribe, with a `packages/api/src/client/appsApi.ts` modelled on `kitsApi.ts`. No HTTP API.

## Progress: Hoon written, partially verified

Written (per the settled decisions): `desk/sur/apps.hoon`, `desk/lib/apps-json.hoon`, `desk/mar/apps/{action-1,update-1}.hoon`, `desk/app/apps.hoon`, and `%apps` registered in `desk/desk.bill`. The agent implements the three channel-host obligations, ports `can-read`/`group-synced` from `%notes` (with its host-not-our.bowl short-circuit), adds `can-write` matching `lib/channel-utils`, and applies the revision/idempotency rules with a host-serves-subscribers stream plus a local mirror.

**Verification status: `sur/apps.hoon` compiles. `lib/apps-json.hoon` does not.** The other three files are untested because the lib is a dependency of all of them.

I could not isolate the `apps-json` failure. The nest-parser construct I suspected (`(cu |=(…) (su ;~((glue fas) sym ;~(pfix sig fed:ag) sym)))`) compiles fine in isolation, so the bug is elsewhere in that file. Cheapest next step is to bisect it: write the enjs half and the dejs half to `lib/t1.hoon` / `lib/t2.hoon` in the dev desk, commit once, and build each as a click dep. Failing that, restructure the file to mirror `kits-json.hoon` line-for-line, since that one is known to compile in this desk.

**Getting a compile-check working at all took most of the effort, and the recipe is worth keeping** (saved to memory as `hoon-desk-verify-recipe`):

- **`%groups` on the rube pier cannot accept local commits.** It is remote-sync-tracked, so `|commit %groups` reports success and does nothing — clay never receives the files. This is why my first several commits appeared to work and changed nothing. A fresh `%appsdev` desk takes commits normally.
- `click` from `apps/tlon-web/rube` is the compile-check tool: `./click -b <binary> /tmp/pz '%ok' /~zod/appsdev/<case>/lib/foo/hoon`. `[0 %avow 0 %noun 27503]` means it built.
- Three traps that each look like a Hoon bug and are not: `ASDF_PYTHON_VERSION=3.12.13` is required or `socket_proxy.py` never starts and asdf's error text corrupts the newt; the pier needs a short symlink path or AF_UNIX overflows; and the clay case must be a real past date, not a future one.
- **Only single-line expressions survive `click -i`** — multi-line input dies as `syntax error {1 9}`. My first isolation attempts were invalid for this reason, not because the Hoon was wrong.
- `.^` does not work inside `ted/eval`, and `-build-file` reports failure without the error leaf, so there is no easy way to read a compile error directly.

Still to do: fix `apps-json`, verify the remaining three files, write `desk/tests/app/apps.hoon`, the client side (ChannelType `'app'` plus the four required arms and three presentation arms, `createAppChannel`, `appsApi.ts`), and the two docs.

## All five Hoon files now compile

`sur/apps.hoon`, `lib/apps-json.hoon`, `mar/apps/action-1.hoon`, `mar/apps/update-1.hoon`, `app/apps.hoon` — each verified building on a ship via `click` (`%ok` = 27503).

**Correction to my earlier note: `%groups` was never refusing local commits.** The real cause of every "commit succeeded and changed nothing" symptom was `rsync -a` preserving source mtimes, which vere's mount driver reads as "no changes" — so clay never received the files and I was rebuilding stale versions for hours. `find <mount> -type f -exec touch {} +` before `|commit` fixes it. The sync-tracking theory was wrong and the memory note has been corrected.

Once a real error channel existed (the ship log carries `clay: %a build failed` plus the actual `nest-fail`/`-find`/`mull-nice` leaf with line and column — click itself only returns an opaque `%thread-fail`), the remaining bugs took three cycles:

1. **`nest:c` pins its kind to `?(%diary %heap %chat)`**, and the `%channel` arm of `%groups`' action type uses it — so casting an `%apps` nest to `a-groups:g` fails to compile even though `%groups` accepts the noun fine. This is exactly why `%notes` defines its own `nest`/`group-create`/`group-channel-del` locally, and I now do the same: `sur/apps.hoon` carries `$nest`, `$channel-join`, `$channel-leave`, `$channel-active`, `$group-channel`, `$group-add`, `$group-del` with an unrestricted kind. Worth knowing for anyone adding a third channel host — it is the one non-obvious blocker in the whole contract, and it belongs in `docs/backend/channel-hosts.md`.
2. A wet-gate inference failure on `(scag max-applied:a [id applied.d])`; fixed by binding the list explicitly first.
3. `flag.cj` → `group.cj` after the local `channel-join` renamed that field.

The rewrite also simplified the wire format per the "match kits-json" decision: channels are keyed by **flag** (`~ship/name`) rather than nest, since the kind is always `%apps`. That removed the only construct `kits-json.hoon` does not have (a compound `su`/`cu` nest parser) and left `fl` verbatim from kits. `readers`/`writers` decode as lists via `ar` and are `silt`ed in the agent.

Still to do: `desk/tests/app/apps.hoon`, the client side (ChannelType `'app'` plus the four required arms and three presentation arms, `createAppChannel`, `appsApi.ts`), and the two docs (`docs/apps.md`, `docs/backend/channel-hosts.md`).

## Complete

Two commits: `e4c8885a83` (agent + tests) and `c56404a723` (client + docs).

### Agent tests — AC #4

`desk/tests/app/apps.hoon`, 22 tests, **all passing** on a fakezod: `-test /=appsdev=/tests/app/apps` → `ok=%.y`. Coverage is creation and the group listing, the revision and idempotency rules (round trip, stale `expected` conflict, replay no-op, no-change write holding the revision, `~` expected as last-write-wins), both channel-host pokes including the own-channel no-op and the unsubscribe, forwarding a write to a host we do not own plus the from-self guard on it, delete, the bulk read filter, and the permission gate from a non-member's side.

**One real bug the tests caught.** The `?-` in `+poke` narrows `action` to the `%write` arm, so the forwarded poke carried a narrowly-typed vase where the mark's type is the whole union. Harmless at runtime, a nest-fail waiting for anything that reads it as `$action` — fixed by casting back to `action:v1:a` on the way out. I fixed the agent rather than loosening the test, since the test was asserting the right thing.

### Client — AC #2

`packages/api/src/client/appsApi.ts` (12 tests) plus `createAppChannel` in the store (5 tests). Notes on what the plan got right and wrong:

- **The measured blast radius held.** Adding `'app'` to `ChannelType` produced exactly the two predicted compile errors in `PostCollectionConfiguration.ts`, and nothing else.
- **One site the plan listed needs nothing after all.** `fallbackRendererIdForChannelType` already returns null via `default`, which is the correct answer for an app channel — there is no registered fallback in this build, and the degraded path is the intent. Adding an arm returning null would have been noise.
- **One site the plan did not list.** `api.createChannel`'s `kind` is `Kind` (`heap|diary|chat|notes`), and `getChannelKindFromType` now returns `'apps'` too. App channels never reach that call, but TS cannot see it: `channelType` is declared as `Omit<ChannelType, 'dm' | 'groupDm'>`, and `Omit` over a string union does not narrow. Cast at the call site with a comment saying so. Worth someone changing that `Omit` to `Exclude` in its own pass — not this task.
- **Reused rather than copied.** `waitForNotesChannelListing` was generic apart from its name, so it is now `waitForChannelListing` shared by both third-party creation paths, with `ChannelListingUnverifiedError` renamed to match. All references were local to the file.
- **Presentation arms.** `getChannelTypeIcon` and `getChannelTypeName` both defaulted to the *chat* icon and "Chat channel", which actively misreads a document as a chat. There is no app-like icon in the set, so both are now generic (`Channel` / "App channel"). Deliberately **not** added to the create-channel picker — this task ships no UI.

### Docs — AC #5

- `docs/apps.md` — the agent spec CLAUDE.md requires.
- `docs/backend/channel-hosts.md` — the third-party channel-host contract, which was load-bearing and written down nowhere. It carries both traps that each cost a cycle: `nest:c` pinning its kind so an `%apps` nest will not cast to `a-groups:g`, and `can-read` having to short-circuit on the channel's **host** rather than on `our.bowl` or a revoked subscriber keeps its stale mirror. Also notes that `%notes` is absent from `desk.bill` and not to copy that.

### Verification

`tsc --noEmit` clean across api, shared, app, ui. Tests: api 824, shared 447, app 504 — all passing. Prettier clean on the diff, including the two new docs.

One Hoon-verify note worth keeping: the fakezod had no readable slog, so `-test` reported only `ok=%.n` with no detail. Restarting the pier with `-t` and stdout to a file is what made the failure legible — without it there is no error channel at all. Added to the existing `hoon-desk-verify-recipe` memory.

### Still out of scope, as planned

No renderer (the registry from TASK-6 handles the degrade), no kit-facing place declaration (needs the place vocabulary extended — TASK-15), no action log or replay (TASK-21), no agent CLI surface.
<!-- SECTION:NOTES:END -->
