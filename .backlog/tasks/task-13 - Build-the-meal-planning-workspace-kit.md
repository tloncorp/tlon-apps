---
id: TASK-13
title: Build the meal-planning workspace kit
status: To Do
assignee: []
created_date: '2026-08-19 13:48'
updated_date: '2026-08-20 15:29'
labels:
  - workspaces
  - kits
milestone: m-1
dependencies:
  - TASK-1
  - TASK-2
  - TASK-8
references:
  - PLAN.md
priority: high
type: feature
ordinal: 2800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The hero activation kit from PLAN.md: weekly meals and grocery list. Meal planning is the recommended first wedge because it is immediately generative, naturally collaborative, produces a visible durable artifact, and supports recurring behavior without integrations. If the capability-matrix spike selected a different hero, build that instead — the shape is the same.

The kit (in the format landed by the kit-foundation task) defines the workspace's purpose and agent behavior, its named places (one primary conversation, one durable artifact store initially backed by %notes), the starter artifact the agent produces on first run, and the recurring schedule that is offered only after the first result — never during onboarding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Kit installs into a workspace group and writes its configuration into the workspace descriptor
- [ ] #2 Kit defines a primary conversation and a durable artifact place backed by notes
- [ ] #3 On first run the agent produces a durable starter artifact (a meal plan / grocery list) visible in the workspace
- [ ] #4 A recurring schedule is defined by the kit but not activated until offered after the first result
- [ ] #5 Kit content (prompts, copy, artifact templates) contains no provider- or model-specific configuration
- [ ] #6 Tests cover kit installation and descriptor contents
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

**AC #2 as written is not currently buildable, and that is the whole story of this task.** §1. One decision follows from it, in §2.

### 1. A kit cannot declare a notes place, and its only "durable artifact" option is a removed channel type

Three facts, each verified:

- **`placeKindSchema` is `z.enum(['chat', 'notebook', 'gallery'])`** (`packages/tlon-kits/src/manifest.ts:34`). There is no `notes`.
- **`+place-kind` in `desk/app/kits.hoon:256` maps only onto `%channels` kinds** — `%chat`→`%chat`, `%notebook`→`%diary`, `%gallery`→`%heap` — and `+install` creates every place with a single `channel-action-2` `%create` poke to `%channels` (`:122-129`). A third-party channel host is not reachable from that code path at all.
- **`%diary` is deprecated and replaced by `%notes`.** `DIARY_REMOVED` in `packages/tlon-skill/scripts/cli-utils.ts:142` says so in as many words: *"diary/notebook channels are deprecated and unsupported by this CLI — they have been replaced by %notes"*, and it points at `tlon notes migrate-plan` / `migrate-apply` as the owner's path off them.

So today a kit's only durable-artifact place is `notebook`, which instantiates a `%diary` channel, which is the thing the product is migrating *away* from. Building the hero kit on it would ship a workspace whose artifact store needs migrating on day one.

This is the same gap I flagged from TASK-7 — the place vocabulary needs extending before a kit can name a `notes` (or `apps`) place — and it lands squarely on this task's AC #2.

### 2. Decision — extend the place vocabulary here, or defer

- **(a) Extend it here.** Add `notes` to `placeKindSchema`, and teach `%kits` `+install` to create a notes place through `%notes` rather than `%channels`. That is a new branch in `+install` (a different agent, a different action mark) plus the `+place-kind` map becoming partial. Real Hoon work with a ship-verify loop, but it is the thing that makes AC #2 literally true and it unblocks `apps` places later by the same seam.
- **(b) Build the kit with a `notebook` place and carry the swap.** The kit ships now, complete and testable, with its artifact place on `%diary`; a follow-up moves it to `%notes` when the vocabulary lands. Cheap, and the kit content — instructions, copy, schedule, starter artifact — is identical either way. The cost is shipping the hero workspace on a deprecated channel type, and AC #2 saying "backed by notes" would be false.
- **(c) Split the task.** Extend the vocabulary as its own piece of work (it is really TASK-15's territory — "promote kits into the supported workspace-template format"), then build the kit on top.

**I recommend (c), with the vocabulary extension pulled forward into its own task rather than TASK-15.** My reasoning: the extension is backend work with a ship-verify loop and a blast radius across `manifest.ts`, `kits.hoon`, and `%notes` channel creation; the kit is content plus tests. Mixing them makes one commit that is hard to review and hard to revert, and it puts a Hoon build in the path of shipping the hero content. Separating them also means the extension gets tested on its own terms — a notes place created by `%kits` and joined by a member is a real round trip worth verifying independently of anything about meals.

If you would rather not add a task, **(a)** is my second choice and I would do the extension first in the same branch, as its own commit. I would not pick (b): "the hero workspace's artifact store is a channel type we are migrating off" is exactly the kind of thing that quietly becomes permanent.

**This is the decision I need.** Everything below is the kit itself, which is unchanged by it apart from one line in `kit.json`.

### 3. The kit — content, and what the ACs actually constrain

`packages/tlon-kits/kits/meal-plan/`, mirroring `book-club`'s layout exactly (it is the only existing kit and its shape is the spec).

**Places (AC #2).** Two, per PLAN.md's "one primary conversation, one durable artifact store":

| place | kind | why |
| --- | --- | --- |
| `kitchen` | `chat` | the primary conversation — where the plan gets discussed and where cards land |
| `plans` | `notes` (or `notebook`, per §2) | the durable artifact: this week's plan and grocery list, and every past week |

**Bindings.** `runner.md` ambient (how to behave in this workspace at all), `setup.md` on `install.setup`, `weekly-plan.md` on `schedule.weekly-plan`.

**Schedule (AC #4).** One: `weekly-plan`, Friday afternoon (`0 17 * * 5`) — plan the coming week. Declared in the manifest, and **`schedules` is written into the descriptor at install** so the agent can see it. AC #4 says it must not be *activated* until offered after the first result, which raises a question the plan should answer rather than assume: see §4.

**Starter artifact (AC #3).** `setup.md` instructs the agent, on first run, to produce a real week: seven dinners with a one-line note each, plus a grocery list grouped by aisle, written into the `plans` place as a dated document. Doc-1 §5's day-one framing requirement for meals was that the first turn must *propose* rather than interrogate — so setup produces a complete plan the household edits, not a questionnaire.

**Scaffolds.** A `Meal Plan/Preferences.md` for standing constraints (allergies, dislikes, what the household actually eats) and a `Meal Plan/Profile.md` matching book-club's pattern.

**Policy.** `required`: answer and act when mentioned in owned channels; run the schedule. `recommended`: notice meal talk without a mention. Copied in shape from book-club, which is the reviewed precedent.

**AC #5 — no provider or model specifics.** Straightforward and worth a test rather than an eyeball: nothing in the kit names a provider, a model, an API, or a temperature. Kits are markdown the harness loads into whatever model is configured; that is the whole design (`docs/kits.md`). A test that greps the kit's files for a list of forbidden tokens is cheap and catches a future contributor pasting a model name into a prompt.

### 4. The gap in AC #4 that needs naming

AC #4: *"A recurring schedule is defined by the kit but not activated until offered after the first result."*

The kit can declare the schedule, and the descriptor records it. But **nothing today distinguishes a declared schedule from an active one.** `GroupKitSchedule` is `{id, cron}` — there is no enabled flag, and `%kits` writes every declared schedule into the blob at install. So as things stand, installing the kit activates the schedule immediately, which is precisely what this AC forbids.

Two ways to satisfy it:

- **Add an `enabled` flag** to the schedule shape, defaulting false, flipped when the user accepts the offer. Small, additive, and it makes "declared but not active" representable — which it currently is not. The executing agent then only fires schedules with `enabled: true`.
- **Have `%kits` write no schedules at install**, and add them to the descriptor when accepted. Also works, but it loses the declaration — the client cannot offer a schedule it cannot see.

**I recommend the `enabled` flag.** It keeps the declaration visible so TASK-23 ("offer the recurring schedule contextually after the first result") has something to offer, and it is one optional boolean on a schema that already tolerates unknown keys.

I will implement that as part of this task since AC #4 cannot be honestly checked without it — but flagging it because it is a schema change I did not have in the original scope, and because the *offer* itself is TASK-23, so what closes here is "declared, recorded, and not firing".

### 5. Tests — AC #6

- **Manifest validity** — `kit.json` parses through `kitManifestSchema` and `toWireKit` round-trips it. This is what `kits.test.ts` already does for book-club, so it is the same shape.
- **Install writes the descriptor (AC #1)** — extend `desk/tests/app/kits.hoon`, which already covers install for the fixture kit, with a meal-plan case asserting the blob's places, schedules, agents, and `setup: pending`. The Hoon test harness is in place from TASK-2.
- **Descriptor reads back** — through TASK-8's helpers: `isWorkspace`, `workspacePlace(d, 'kitchen')`, `workspacePlace(d, 'plans')`, the schedule present and not enabled. This is the first real use of those helpers and worth exercising deliberately.
- **Schedule declared but inactive (AC #4)** — the flag is false after install.
- **No provider or model specifics (AC #5)** — the grep test from §3.

I cannot test AC #3 (the agent produces a starter artifact) with anything but a live agent: it is a model following instructions. What I *can* test is that the instruction file exists, is bound to `install.setup`, and names the `plans` place. I will say plainly that the artifact itself is unverified rather than imply otherwise.

### 6. Verification

`pnpm -r tsc`, the tlon-kits/api/shared suites, prettier. If §2 lands as (a) or (c)-then-here, the Hoon needs a real desk build and the `-test` run on a fakezod — the recipe is in my notes and the pier is already set up.

### 7. What this does not do

- **No provisioning.** Installing this kit during onboarding is TASK-16; `starterKitId: 'meal-plan'` from TASK-5 is the id it will name, and that id matches this kit's `id` deliberately.
- **No schedule offer.** TASK-23.
- **No cards.** The meal card that uses TASK-10/12's interactive surfaces is a natural next step for this kit, but nothing in these ACs requires it and I would rather ship the kit and add the card knowingly.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research notes, before any code.

**AC #2 is not currently buildable. A kit cannot declare a notes place, and its only durable-artifact option is a removed channel type.** Three verified facts:

1. `placeKindSchema` is `z.enum(['chat','notebook','gallery'])` (`packages/tlon-kits/src/manifest.ts:34`) — no `notes`.
2. `+place-kind` (`desk/app/kits.hoon:256`) maps only onto `%channels` kinds (`%chat`→`%chat`, `%notebook`→`%diary`, `%gallery`→`%heap`), and `+install` (`:111-130`) creates every place with one `channel-action-2` `%create` poke to `%channels`. A third-party channel host is not reachable from that path at all — there is no branch for one.
3. **`%diary` is deprecated in favour of `%notes`**, in as many words: `DIARY_REMOVED` (`packages/tlon-skill/scripts/cli-utils.ts:142`) reads "diary/notebook channels are deprecated and unsupported by this CLI — they have been replaced by %notes", and points at `tlon notes migrate-plan`/`migrate-apply` as the owner's exit.

So the hero kit's artifact store would have to be a `%diary` channel, which is the thing the product is migrating away from. This is the same place-vocabulary gap I recorded in TASK-7's plan ("a kit naming an app place needs the place-vocabulary extension carried to TASK-15"); it lands on this task's AC #2 rather than staying theoretical.

**AC #4 also cannot be honestly satisfied by the current schema.** `GroupKitSchedule` is `{id, cron}` — there is no enabled/active flag — and `%kits` writes every declared schedule into the blob at install (`kits.hoon:133-136`). So "declared but not activated" is not currently representable: installing the kit activates the schedule. Needs one optional boolean, which the `.passthrough()` entry schema tolerates.

**book-club is the only existing kit and is the de facto spec.** `kits/book-club/` has `kit.json` plus `instructions/{runner,setup,monthly-pick,weekly-nudge}.md`, `scaffolds/{Profile,Reading Log}.md`, and `card/summary.md`. Its manifest carries `places` (name → `{type,title,description}`), `bindings` (file + scope + optional trigger + `ambient`/`on-trigger`/`pulled`), `schedules` ({id, cron, description}), `scaffolds` (file → workspace path), and a `policy` split into `required`/`recommended` with per-entry `reason` and `level`. Triggers are namespaced: `install.setup`, `schedule.<id>`. Copying that shape is the right move rather than inventing a second one.

**doc-1 §5's day-one framing requirement applies to `setup.md`, not to the picker.** For meals the requirement was that the first turn **propose** a week rather than interrogate the household — so setup should emit a complete plan to edit, not a questionnaire. (The sibling requirements were: household tasks must propose a routine rather than ask for a chore list; garden must lead with a location question.)

**TASK-8's helpers are ready and this is their first real consumer.** `isWorkspace`, `readWorkspaceDescriptor`, `workspacePlace`, `workspaceHasCapability`, `isWorkspaceSetupComplete`, `workspaceAgents` all landed in `8038a60b39`, so the descriptor assertions in AC #6 can go through the real read path rather than re-parsing the blob.

**The kit id matters and is already spoken for.** TASK-5 records `starterKitId: 'meal-plan'` in `signupData` from the onboarding picker, so this kit's `id` must be exactly `meal-plan` or provisioning (TASK-16) will not find it.

**AC #5 is testable rather than reviewable.** "No provider- or model-specific configuration" is a property of the kit's files, so a test that greps them for forbidden tokens (model names, provider names, `temperature`, `api_key`) catches a future contributor pasting a model name into a prompt — which a code review would likely miss.

**AC #3 cannot be tested here.** "On first run the agent produces a durable starter artifact" is a model following instructions; it needs a live agent. What is testable is that the instruction exists, is bound to `install.setup`, and names the artifact place. I will say the artifact itself is unverified rather than imply coverage.

**Hoon test harness is available.** `desk/tests/app/kits.hoon` already covers install for a fixture kit (278 lines, `test-agent` monadic style), so asserting the blob contents for a real kit extends existing work rather than starting from nothing.
<!-- SECTION:NOTES:END -->
