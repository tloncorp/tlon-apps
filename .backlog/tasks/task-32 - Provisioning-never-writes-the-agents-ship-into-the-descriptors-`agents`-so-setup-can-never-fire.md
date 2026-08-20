---
id: TASK-32
title: >-
  Provisioning never writes the agent's ship into the descriptor's `agents`, so
  setup can never fire
status: In Progress
assignee: []
created_date: '2026-08-20 21:55'
updated_date: '2026-08-20 23:25'
labels:
  - workspaces
  - kits
  - openclaw
  - onboarding
dependencies: []
priority: high
type: bug
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`%kits` writes `agents: [our]` at install — the *installing* ship (`desk/lib/kits-json.hoon:125`, `['agents' a+~[s+(scot %p our)]]`). But `agents` means "which ships' agents may execute this workspace's kit" (`workspaceAgents` in `packages/shared/src/logic/workspaceDescriptor.ts`), and the agent is a **different ship** — a separate bot @p seated as a group member, per TASK-16 AC #1 ("a secret group with the agent seated as a member").

Nothing ever corrects it. `grep agents packages/shared/src/store/workspaceProvisioning.ts` returns nothing: TASK-16 seats the agent via `ensureWorkspaceAgentSeated` but never updates the descriptor. So the descriptor claims the human's ship is the executing agent.

The consequence is that setup can never fire. `shouldFireSetup` (`packages/openclaw/src/kits/setup.ts:37`) requires `entry.agents.includes(botShip)`, and `botShip` is the harness's own ship. Installer ≠ bot, so the gate is always false — the kit's `install.setup` instruction never runs and the starter artifact never appears.

**This is not local-rig-only.** In production the bot is a moon (`~moon-sampel`), a different `@p` from the installing ship (`~sampel`), so the same mismatch holds. Observed on the walkthrough rig: three workspaces on `~ten`, all with both places created correctly, all stuck at `setup: "pending"` with an agent that could never claim them.

Related gap found alongside it: TASK-16 deliberately does not write the descriptor at all, to avoid racing `%kits`' own blob write (last-write-wins on the cord). So "who writes `agents` after seating, and how without clobbering the install's write" is the actual design question — possibly `%kits` should take the agent ship as an install parameter rather than assuming `our`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After provisioning, the descriptor's `agents` names the ship whose harness will execute the kit, not the installing ship
- [ ] #2 A kit install by ~ten with a bot on ~zod fires setup, and the starter artifact appears
- [ ] #3 Whatever writes `agents` does not race or clobber the blob write %kits performs during install
- [ ] #4 Production's moon-based bot satisfies the same path — the fix is not specific to two independent ships
- [ ] #5 A test covers installer ≠ agent, so the case that is broken today cannot silently return
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Partial fix in `d38fa8fd30`. **The end-to-end behaviour is still broken** — recording where it stands so the next session does not re-derive it.

### What is in place

- `+$ install` carries `agents=(set @p)`, so both `write-blob` call sites emit the same value rather than one of them re-deriving from `our`. This required versioned state: `state-0` keeps an `install-0` shape and `+on-load` migrates, filling `agents` with `our` — which is what an entry written before the field implied.
- The `%install` action takes `agent=(unit @p)`; `~` means the installer.
- `installKit` requires `agent: string | null`, deliberately not optional.
- Provisioning resolves the agent **before** poking install, since `%kits` writes the descriptor in the same event and a later correction would race the blob write.

Hoon compiles; `-test /=groups=/tests/app/kits/hoon` and `.../notes/hoon` both returned `ok=%.y` against a build with the threading live. tsc clean, shared 516 / api 838 / app 562 passing.

### What is broken

An install carrying `agent: "~ten"` (and separately `"~bus"`) still records `agents: ["~zod"]` in the group blob — the installer. Three separate installs on ~zod, all `["~zod"]`. So the decoded `agent` is arriving as `~` and `+install` takes its `our.bowl` fallback.

Ruled out by direct inspection of the **deployed** desk in the pier mount:

- `sur/kits.hoon:115` has `[%install =id name=term meta=data:meta agent=(unit @p)]`
- `app/kits.hoon:114` passes `agent.action`
- `app/kits.hoon:161` is `(sy ~[?^(agent u.agent our.bowl)])`
- `lib/kits-json.hoon:218` is `agent+(mu (se %p))`
- `mar/kits/action-1.hoon` delegates `grab.json` to `action:dejs:j`, so the lib is the conversion path

The payload sent was `{install: {id, name, meta, agent: "~ten"}}` over the channel API with mark `kits-action-1`.

Unverified hypotheses, cheapest first: the `ot` key order versus the tuple order in the action type; whether `agent` inside `+install` is shadowed by the helper core's `++agent` arm (it compiles, which argues against, but worth confirming); whether `(se %p)` accepts `"~ten"` as written; whether the channel poke's JSON reaches `grab.json` at all rather than `grab.noun`.

### The missing test, which is the actual lesson

The JSON boundary had no coverage. `desk/tests/app/kits.hoon` pokes vases directly with `!>`, so dejs was never exercised — structurally the same hole as the notes card assertion in `237503eb4f`, where the test asserted the shape the sender built rather than the shape the recipient accepts. `desk/tests/lib/kits-json.hoon` now asserts a decoded `~bus` and a decoded null, and **has never been run**: the fakezod's lens began returning 500 for every poke before I could, including for tests that had passed minutes earlier.

Running that test is the first thing to do next — it should fail, and it should say why.

## Root cause found, fix verified live — and two new findings past it

**The "JSON boundary yields ~" mystery had no JSON in it.** A perl edit to `+install`'s gate had matched twice, leaving a duplicate unindented `|=` line at column 0. Every `|commit` after that failed to build, on both ships — so the threading was never live and the decoder was never exercised. Three verifications lied in the same direction: the lens returns `">=" HTTP 200` even on build failure (sink ack, not build result); `-test` after a failed commit runs the OLD tests against the OLD app, so `ok=%.y` proved only self-consistency of the last-landed desk; and "deployed source inspection" read the pier mount, not clay. The honest check — scry the file from clay and `find` a distinctive string — is now in the desk-verify memory note. Fixed in `a7fb6a18d4`, along with the one `%install` poke the test sweep missed (collision test line 445, still 4-tuple, which failed the whole test file's build once the desk actually landed).

**Verified live on ~ten once the desk truly landed:**
- clay content probe `%.y`; `tests/lib/kits-json` decoder test `ok=%.y` — `"agent":"~bus"` decodes to `[~ ~bus]`, null to `~`.
- Real install via eyre channel: `~ten/task32-e2e` with `agent: "~zod"` → ledger `agents:["~zod"]`, blob `agents:["~zod"]`. **AC #1 checked on this evidence.**
- Invited ~zod; openclaw auto-accepted and auto-watched the kitchen; after a restart, `kits: enqueued setup conversation for meal-plan-0 in ~ten/task32-e2e` — the first cross-ship setup fire. The restart was needed because reconcile only ran on blob-update facts or boot; fixed in `1dd184aa68` (post-join reconcile), since provisioning installs before seating the agent, meaning production always hits this window.

**Finding 1 — `setup-done` cannot close for a cross-ship workspace.** Immediately after the enqueue: `[SSE] Poke NACK … /app/kits/hoon:<[154 19]…` — openclaw pokes `setup-done` at its OWN `%kits`, whose `+setup-done` does `~(got by installs) flag`, and the ledger lives on the installer's ship. Crash → NACK → the durable fire-once guard never closes → `setup: "pending"` persists in the blob and every bot restart re-fires setup (duplicate starter conversations). Same installer≠agent assumption, one layer deeper. A ship cannot poke another ship's agent over eyre, so the fix is protocol: `+setup-done` on the agent's %kits should relay to `[ship.flag %kits]` over ames, and the host's `+setup-done` should accept a remote src that is listed in that install's `agents`. Interacts with TASK-31 (what `setup` means).

**Finding 2 — the enqueued setup turn never executes.** Gateway has a live model (`openrouter/openai/gpt-5.6-terra`), enqueue logs, then silence; kitchen channel has zero posts (`channels/v1/...posts/newest` → `{"posts":{},"total":0}`) while the notebook place exists. The systemEvent→agent-turn handoff is the last unlit link in the activation chain and is not yet diagnosed.

**Test status, claimed precisely:** JS provisioning tests pass and were proven to bite (2 fail when the fix is reverted). Decoder test ran on-ship and passed. The updated `tests/app/kits.hoon` (installer≠agent fixtures) is committed but has not RUN — both fakezods' lenses now 500 on pokes/threads (expressions still evaluate), so the line-445-fixed test file can't land or run until the ships restart. AC #5 stays unchecked until it executes.
<!-- SECTION:NOTES:END -->
