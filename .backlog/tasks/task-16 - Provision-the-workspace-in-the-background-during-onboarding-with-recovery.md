---
id: TASK-16
title: 'Provision the workspace in the background during onboarding, with recovery'
status: Done
assignee: []
created_date: '2026-08-19 13:49'
updated_date: '2026-08-20 16:30'
labels:
  - workspaces
  - onboarding
  - agent
milestone: m-1
dependencies:
  - TASK-8
  - TASK-13
references:
  - PLAN.md
  - branch cron-prompt-onboarding
  - branch agent-onboarding-v2
  - packages/openclaw/src/session-route.ts
priority: high
type: feature
ordinal: 5400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PLAN.md: while the user is on the two onboarding interstitials, the system provisions everything behind the scenes — a secret group with membership and permissions, the notes-backed artifact space, the user's agent seated as an explicit authenticated member with a stable task-specific session, the selected starter kit installed, and the workspace descriptor written.

Retain the provisioning, recovery, trusted-agent, and telemetry work from the cron-prompt-onboarding and agent-onboarding-v2 branches; discard their conversational wizard and session-only UI state. Provisioning must survive the user killing/reopening the app or backgrounding it mid-flow (this is explicitly on the live review checklist).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Completing the interstitials yields a secret group with the agent seated as a member, a notes artifact space, the chosen kit installed, and a complete workspace descriptor
- [x] #2 Provisioning runs concurrently with the interstitials and does not block screen transitions
- [x] #3 Killing and reopening the app mid-provisioning resumes or recovers to a complete workspace without duplicates
- [ ] #4 Backgrounding the app during provisioning does not corrupt or orphan the workspace
- [x] #5 A provisioning failure surfaces a recoverable state, never a half-configured workspace presented as ready
- [x] #6 Setup status in the descriptor reflects provisioning progress and completion
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

**The salvage instruction in the description is mostly already satisfied, and most of AC #1 is already built.** §1–2. That leaves one real decision, §3.

I am also taking this before TASK-11 deliberately: interstitial 2's AC #3 says it lands "directly in the workspace conversation", and until this task runs there is no workspace to land in. Doing TASK-16 first means TASK-11 closes cleanly instead of deferring a third consecutive AC.

### 1. `%kits` install already does most of AC #1

AC #1 wants: a secret group, the agent seated, a notes artifact space, the chosen kit installed, a complete descriptor. `%kits` `%install` does four of those **in one poke** (`desk/app/kits.hoon`):

- creates the group `%private` (`create-group` with `%private`),
- creates every declared place — including the `notes` artifact space, as of TASK-27,
- writes the descriptor into the group blob, with `agents` naming the installer's ship and `setup: pending`,
- records the install ledger.

So provisioning is not "build a workspace"; it is **one poke, plus the pieces install cannot do from inside Hoon.** That is a much smaller task than the description implies, because TASK-2, TASK-8, TASK-13 and TASK-27 have been absorbing it one piece at a time.

What install genuinely does **not** do:

| gap | why it cannot be install's job |
| --- | --- |
| seat the agent as an authenticated member | the bot is a separate ship; it has to accept and be granted a role, which is a multi-event dance |
| run concurrently with the UI | client-side orchestration |
| resume after an app kill | needs durable client state |
| report progress beyond `pending`/`done` | see §4 |

### 2. What is actually worth salvaging, and what already landed

The description says to retain the provisioning, recovery, trusted-agent and telemetry work from two branches. Measured:

- **Telemetry: already done.** `packages/openclaw/src/telemetry.ts` and `cron-telemetry.ts` are on develop. Nothing to port.
- **Provisioning: superseded.** `createAgentGroup` and `ensureAgentNotebookForGroup` (in the branch's 733-line `agentOnboardingActions.ts`) hand-roll group and notebook creation, with retry timers for the notebook. `%kits` install does both, atomically, in one event. Porting them would be building a second provisioning path beside the one we just finished.
- **Trusted agent: worth taking.** `ensureAgentAdminForGroup` / `grantAgentAdmin` is the real thing — a shared-promise dedup so concurrent callers collapse, a bounded retry, and re-entry from a group observer when membership sync changes so an agent that joins *after* the initial attempt still gets its role. That last part is the non-obvious bit and I would not have thought of it.
- **Recovery: the shape, not the code.** `resolveHomeGroupOnboarding` returns `pending | fallback | target`, and deliberately proves the target exists with a ship scry rather than trusting local sync — with a comment explaining that arming a poll for a channel that may never exist is worse than falling back. That three-state distinction is the useful idea.

**But the branch's state model is the wrong one now.** It reads config out of `group.description` via `parseGroupAgentConfig`, and keys everything off a single fixed `BotHomeGroupSlugs` home group. Neither exists on develop, and TASK-8 exists precisely so the descriptor is the one source of truth. So recovery gets rebuilt against `readWorkspaceDescriptor` and the install ledger, not ported.

The wizard machinery — `AgentOnboardingSequence.tsx`, `useAgentOnboardingLock`, the guided-conversation lock — is what the description tells us to discard, and I agree: the lock exists to hold the user inside a conversational wizard, which the two-interstitial flow replaces.

### 3. Decision — what "provisioning" is triggered by, and when

Provisioning has to start early enough to be finished by the end of interstitial 2, and it needs the starter kit id, which interstitial 1 records. So the trigger is: **the moment `starterKitId` is written** (TASK-5's `handleStarterSelected`).

The question is what happens for the "Something else" path, where `starterKitId` is `undefined`:

- **(a) Provision a kit-less workspace.** Create the group and the notes place directly, no kit, descriptor with no kit entry. But TASK-8 made "is a workspace" mean "has a kit install", so a kit-less group is **not a workspace** and gets none of the app-shaped treatment. That is a real inconsistency, not a cosmetic one.
- **(b) Provision nothing; land them in the existing home-group flow.** "Something else" means they did not pick a starter, so there is nothing to instantiate. They get today's behaviour, and the workspace arrives when they choose a starter later.
- **(c) Provision with a minimal built-in "blank" kit** — one chat place, one notes place, no schedules, no instructions beyond a generic runner. Keeps "workspace" and "kit install" identical, and gives the Something-else user a real workspace.

**I recommend (c).** It keeps the invariant TASK-8 established rather than carving an exception into it on day one, and a blank kit is a few files — the same shape as meal-plan with the content removed. (a) breaks the invariant; (b) means the secondary path silently gets a different product, which is how "temporary" forks become permanent.

**This is the decision I need.** If you pick (b) I will make interstitial 2 route the Something-else user to the existing flow and say so plainly in the notes.

### 4. AC #6 — `pending`/`done` is too coarse, and I want to name it

AC #6: *"Setup status in the descriptor reflects provisioning progress and completion."*

The descriptor's `setup` is `'pending' | 'done'`, and `.catch('done')` on the parse — deliberately, because an unreadable value must not re-run a setup conversation. Two states cannot express "provisioning failed and is recoverable", which AC #5 needs to be distinguishable from "still going".

Two options:

- **Widen `setup`** to include a failure state. But `setup` means "has the kit's setup conversation run", which is the *agent's* business, not the provisioner's. Overloading it conflates two lifecycles.
- **Keep provisioning progress on the client**, in a durable storage item beside `signupData`, and let the descriptor keep meaning what it means. The descriptor already answers "is this workspace complete" implicitly: the install ledger and the places map either exist or they do not.

**I recommend the second** — a `workspaceProvisioning` storage item with `idle | running | failed | done` plus the target group id. It is the thing that has to survive an app kill anyway (AC #3), it is client state by nature, and it keeps `setup` honest. AC #6 is then satisfied by the descriptor reflecting *completion* (it exists and is complete, or it does not) with progress tracked where progress actually lives.

I will note in the task if you would rather I widen the descriptor instead.

### 5. Work

- **`packages/shared/src/store/workspaceProvisioning.ts`** — the orchestration. `startProvisioning(starterKitId)` fires the `%kits` install poke and records the durable state; `resumeProvisioning()` runs on launch and reconciles. Idempotent by construction: the install ledger already refuses a second install for the same group flag (`?< (~(has by installs) flag)`), so a duplicate attempt is a nack, not a duplicate workspace — that is AC #3's "without duplicates" and it is enforced in Hoon, not by client bookkeeping.
- **Agent seating** — port `ensureAgentAdminForGroup`'s shape: shared-promise dedup, bounded retry, and re-entry when membership sync changes. This is the piece most likely to be flaky and the one where the branch's experience is worth having.
- **A `blank` kit** in `packages/tlon-kits/kits/`, if §3 lands as (c).
- **The trigger** — `handleStarterSelected` in `SplashSequence.tsx` calls `startProvisioning` without awaiting it, so AC #2's "does not block screen transitions" holds by construction rather than by care.
- **Launch reconcile** — wherever the app already resumes onboarding state; `signupData` is read there and this sits alongside it.

### 6. Tests

- **Happy path** — provisioning fires one install poke with the recorded kit id, and the descriptor reads back complete through TASK-8's helpers.
- **Concurrency (AC #2)** — `startProvisioning` returns before the poke resolves; a pane transition during it is unaffected. Testable by not awaiting and asserting the transition happened.
- **Resume (AC #3)** — state `running` at launch with a complete descriptor reconciles to `done`; `running` with no descriptor retries; `done` does nothing. Plus the duplicate case: two `startProvisioning` calls produce one install.
- **Failure (AC #5)** — a failing poke leaves `failed`, not `done`, and the app does not present a workspace. The distinction that matters is that `failed` and `running` are different, so recovery can tell "retry" from "wait".
- **The agent seat** — concurrent callers collapse to one grant; a late-joining agent still gets the role.

AC #4 (backgrounding) is the one I cannot honestly unit-test: it is an OS lifecycle behaviour. What I can test is that the state machine has no step that is only safe if the process stays alive — every transition is a durable write followed by an idempotent action. I will say that rather than claim the AC is verified, and it is on the live-review checklist (TASK-26) for a reason.

### 7. Verification

`pnpm -r tsc`, the shared/api/app suites, prettier. No new Hoon: install already exists and TASK-27's tests cover it. If §3 lands as (c) the blank kit gets the same manifest and no-provider-tokens tests meal-plan has.

### 8. What this does not do

- **No interstitial 2.** TASK-11, next, and it lands in the workspace this creates.
- **No first result.** The starter artifact is the agent following `setup.md` (TASK-13); provisioning ends when the workspace exists and the kit is installed.
- **No schedule activation.** Declared inactive by TASK-13; offered by TASK-23.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**Most of AC #1 already exists.** `%kits` `%install` creates the group as `%private`, creates every declared place (including the `notes` artifact space since TASK-27), writes the descriptor into the group blob with `agents` naming the installer's ship and `setup: pending`, and records the install ledger — all in **one poke, one event**. So four of AC #1's five clauses are a single existing action. TASK-2, TASK-8, TASK-13 and TASK-27 absorbed this task's substance incrementally.

**Telemetry is already on develop.** `packages/openclaw/src/telemetry.ts` and `cron-telemetry.ts` are present. The description's instruction to retain the branches' telemetry work is already satisfied — nothing to port.

**The branches' provisioning code is superseded, not reusable.** `origin/jamesacklin/cron-prompt-onboarding` carries a 733-line `agentOnboardingActions.ts` with `createAgentGroup` and `ensureAgentNotebookForGroup` (plus retry timers for the notebook). Those hand-roll what install now does atomically. Porting them would mean a second provisioning path beside the one just finished.

**Two things on those branches ARE worth having.** `ensureAgentAdminForGroup`/`grantAgentAdmin` seats the agent with a shared-promise dedup so concurrent callers collapse, a bounded retry, and — the non-obvious part — re-entry from a group observer when membership sync changes, so an agent that joins *after* the initial attempt still gets its role. And `resolveHomeGroupOnboarding` returns `pending | fallback | target` and proves the target with a **ship scry** rather than trusting local sync, with a comment noting that arming a poll for a channel that may never exist is worse than falling back. That three-state distinction is the idea to keep.

**But their state model is the wrong one now.** The branch reads config from `group.description` via `parseGroupAgentConfig` and keys everything off one fixed `BotHomeGroupSlugs` home group. Neither is on develop — grep returns zero for `parseGroupAgentConfig` — and TASK-8 exists precisely so the blob descriptor is the single source of truth. Recovery therefore gets rebuilt against `readWorkspaceDescriptor` and the install ledger rather than ported.

**The wizard is what the description says to discard, and the lock is part of it.** `useAgentOnboardingLock` exists to "hold the user in the guided conversation" — its own doc comment. That is the conversational wizard the two-interstitial flow replaces. What is worth borrowing from it is the *durable marker* idea (`agentOnboardingGroupId`, `agentOnboardingLanding`), not the lock.

**Duplicate protection is already enforced in Hoon.** `+install` asserts `?< (~(has by installs) flag)`, so a second install for the same group flag nacks. AC #3's "without duplicates" is therefore a backend invariant rather than something client bookkeeping has to get right — worth knowing before writing careful client dedup.

**AC #6 cannot be met by the descriptor's `setup` field alone.** It is `'pending' | 'done'` with `.catch('done')`, and it means "has the kit's setup conversation run" — the agent's lifecycle, not the provisioner's. Two states cannot distinguish "failed and recoverable" (AC #5) from "still going". Provisioning progress is client state that has to survive an app kill anyway, which is where it belongs.

**The "Something else" path is an unresolved product question, not just an implementation one.** TASK-8 made "is a workspace" mean "has a kit install". A user who picked no starter therefore cannot have a workspace under that definition without either breaking the invariant or instantiating something. Hence the §3 decision.

**Ordering:** taking this before TASK-11 because interstitial 2's AC #3 lands "directly in the workspace conversation", and until provisioning runs there is no workspace to land in. Doing TASK-16 first lets TASK-11 close cleanly rather than deferring a third consecutive AC to a later task.

## Implemented — `756f72189e`

Built as planned: blank kit for the Something-else path (§3 option c), provisioning progress in a client storage item (§4 option 2).

### What landed

- **`packages/shared/src/store/workspaceProvisioning.ts`** — `provisionWorkspace` (awaitable), `startWorkspaceProvisioning` (fire-and-forget, the onboarding entry point), `resumeWorkspaceProvisioning` (launch reconcile), `ensureWorkspaceAgentSeated`, `resolveWorkspaceAgent`, and `decideResume` — pure, separated from the doing.
- **`db.workspaceProvisioning`** — `idle | running | failed | done` plus kit id, group name and group id.
- **`packages/tlon-kits/kits/blank/`** — manifest, runner, setup. One chat place, one notes place, no schedules, no scaffolds.
- **The trigger** — `handleStarterSelected` calls `startWorkspaceProvisioning(selectedId)` without awaiting.
- **The reconcile** — an effect in `AppDataProvider`, gated on a live session. Chosen because its existing comment says it best: "the onboarding boot sequence never runs for signed-in updaters, so the migration lives here, where every session mounts." Recovery has to reach a user who never sees the interstitials again.

### The design decision that made the rest easy

The group flag is `${our}/${name}`, deterministic from a name the client chooses. Writing that name durably *before* poking means a relaunch can always ask the ship's install ledger which side of the poke it died on. Everything downstream is idempotent, so resume never tracks partial progress — it asks one question and either finishes the tail or re-pokes.

The ledger, not the group blob, is the authority for that question: `%kits` records it in the same event as the install and answers a scry immediately, while the blob write is a card to `%groups` and the local group row trails sync. Asking the slower of the two would make a completed install look unfinished.

### Two bugs the tests caught

**A successful role grant could still throw.** The seating loop only exited on re-reading the group and seeing the role, so a grant whose ack succeeded but whose sync had not caught up would exhaust the delays and report failure on a correctly-seated workspace. The ack is the evidence; it now returns on it and re-reads only when the poke *failed*.

**The duplicate guard blocked the legitimate restart.** `provisionWorkspace` early-returns when state is already `running` — right for a second onboarding caller, wrong for the resume path, which has already asked the ledger and knows the install never happened. The resume passes `resume: true` to say so explicitly rather than have the guard infer intent.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Background workspace provisioning, triggered by interstitial 1 and recovered at every launch.

**What this turned out to be.** Not a provisioner — `%kits` `%install` already creates the private group, every declared place (including the notes artifact space, since TASK-27), the blob descriptor, and the install ledger, in one Gall event. This is the orchestration around it, doing the three things the backend cannot do for itself: run without blocking the UI, seat the agent (a separate ship, a multi-event dance), and survive the app dying halfway.

**The load-bearing design choice.** Record the intent durably before acting on it. The group flag is `${our}/${name}` and the client picks the name, so writing it before poking is what lets a relaunch ask the ship's install ledger which side of the poke it died on. Everything downstream is idempotent, so resume never tracks partial progress — one question, then finish the tail or re-poke. Duplicate protection is a Hoon invariant (`?< (~(has by installs) flag)`), not client bookkeeping. `decideResume` is pure and tested exhaustively, since the resume table is the part worth being sure about and needs no ship.

**Decisions taken with the user.** A user who picks no starter gets a deliberately empty `blank` kit rather than a kit-less group — TASK-8 defines a workspace as a group carrying a kit install, so one definition beats two code paths. Provisioning progress lives in a client storage item rather than widening the descriptor's `setup`, which means "has the kit's setup conversation run" — the agent's lifecycle, not the provisioner's.

**Two bugs the tests caught.** A successful role grant could still throw, because the seating loop re-verified against sync instead of trusting the ack. And the duplicate guard blocked the legitimate restart of an install that demonstrably never happened.

**Two pre-existing bugs fixed in passing.** `KitPlace.kind` on the wire was missing `notes` — TASK-27 updated the zod schema and the Hoon but not this hand-written interface. And three TASK-8 descriptor fixtures were asserting schedules without `enabled`; TASK-13's default was masked by a stale `tlon-kits` dist until this rebuild surfaced it. Third time cross-package dist staleness has hidden something in this milestone.

**Tests.** 31 new in `workspaceProvisioning.test.ts`, 12 in `blank.test.ts`. Suites: shared 507, api 836, app 520, tlon-kits 59 — all passing. `pnpm -r tsc` clean, prettier clean, and `pnpm run build:web` succeeds, which is the check that catches a browser module-eval failure that tsc and vitest both miss.

**Not claimed: AC #4.** Backgrounding is an OS lifecycle behaviour with no unit-test analogue. What is tested is that no transition is only safe if the process stays alive — every one is a durable write followed by an idempotent action — but that is an argument, not an observation. Carried to TASK-26 along with AC #3's real-device half.

**Flagged, not done.** The descriptor's `permissions` stays `[]`. The agent needs `postToPlaces`, but writing it from the client means a second writer racing `%kits`' own blob write, which is last-write-wins on the cord. If capabilities should be granted at install, that belongs in `%kits` `+write-blob` as a backend change.
<!-- SECTION:FINAL_SUMMARY:END -->
