---
id: doc-1
title: Workspace capability matrix and hero wedge decision
type: specification
created_date: '2026-08-19 14:16'
updated_date: '2026-08-19 14:21'
tags:
  - workspaces
  - product
  - m-0
---
Outcome of the TASK-1 exercise from PLAN.md rollout step 1. Scores candidate workspace ideas against what the codebase can actually do today, crosses off the infeasible, clusters the survivors, and selects the hero wedge that gates the milestone-2 starter kit and onboarding starter options.

Baseline commit: `c3c5b458b` on `james/agentic-workspace` (= `develop` + backlog setup). All prototype work referenced in PLAN.md is **unmerged**: kits runtime `0f5ebfc28`, kits UI `12c2ae54b`, mini-app demo `385fbe9f0`, agent task rows `6ee72347e`.

## 1. Capability baseline

"Possible today?" in the matrix below is scored strictly against this table. It is a codebase inventory, not an aspiration.

| # | Capability | Status today | Blocker if partial |
|---|---|---|---|
| 1 | Scheduled agent work | Core `cron` tool exists, owner-only, created by asking in DM | No schedule UI anywhere in the app; scheduler lives in OpenClaw core, not this repo |
| 2 | Interactive cards (A2UI) | Agent can post cards; they render in **DMs only** (`StaticChatMessage.tsx:148` gates on `isDmChannelId`, group channels strip the blocks). Components limited to Text/Row/Column/Card/Divider/Button; actions limited to `tlon.sendMessage` and `tlon.navigate` | Agent `posts edit` has no `--blob` and writes `blob: null`, so an edit **wipes** the card (`postsApi.ts:258`). No group-channel rendering. |
| 3 | Renderer registry | Exists but closed — four hardcoded built-ins (`ComponentsKitProvider.tsx:28-47`) | No registration API |
| 4 | Channel types | Six fixed types; `'custom'` silently coerces to `'chat'` (`channelActions.ts:46`) | A real new type needs a Hoon channel kind plus a union member |
| 5 | Notes channels | Full agent CRUD (26 operations); read permission inherits from the group | Writes need an explicit per-notebook role (owner/editor/viewer) — group membership alone is not enough |
| 6 | Group provisioning | `scaffoldPersonalGroup` / `createGroupFromTemplate` create a secret group plus channels in one call; agent has `groups create-owned` | Agent CLI cannot mint invite links (lure) — direct ship invites only |
| 7 | Agent seating | Hosting provisions the bot moon; cordon-then-join-then-poll pattern exists (`BotChannelRulesScreen.tsx:185-236`) | Home group is created hosting-side and is opaque to this repo |
| 8 | Session routing | Stable independent per-nest group sessions (`session-route.ts:43-53`) | Skipped when the route resolves to the main session (core config) |
| 9 | Agent tool surface | `tlon` CLI tool plus core `message`, `read`, `cron`, `exec`, `web_fetch`, `web_search`, `image_search` | **No calendar, email, shopping, payments, health, or smart-home integrations.** Generic MCP OAuth plumbing exists but the provider catalog is hosting-side and effectively empty |
| 10 | Task-progress rows | Ephemeral presence-based `ThinkingState` plus post-hoc ContextLens run inspection | Persistent animated task rows are unmerged (`6ee72347e`) |
| 11 | Group blob / workspace descriptor | Does not exist — `$group` has no blob field | Needs a `$group` blob (backend) or a JSON-in-description squat mirroring `StructuredChannelDescriptionPayload` |
| 12 | Push notifications and reminders | Work only as chat messages (cron → DM → push); the `%activity` event vocabulary is a closed set | No silent, structured, or actionable notification type |

Two consequences dominate everything below.

**Durable artifacts are Markdown notes, and that is fine.** Notes give the agent real CRUD with optimistic concurrency, group-inherited reads, and a visible shared document. Any idea whose artifact is a document or list is feasible today.

**Anything whose core loop is "tap a thing in the shared space" is not feasible today.** Cards render in DMs only, and an agent edit destroys the card's blob. So tap-driven ideas are scored `degraded`, not `yes`.

## 2. The matrix

Seven columns exactly as PLAN.md specifies. `Possible today?` is one of **yes** (core loop works now), **degraded** (works, but through chat text where the idea wants taps or structure), or **no** (crossed off).

| # | User job | People / agents | Required authenticated action | Durable data produced | Trigger | Possible today? | Missing dependency |
|---|---|---|---|---|---|---|---|
| 1 | Decide the week's dinners and know what to buy | 1–2 adults + agent | Agent writes and revises notes in the secret group | "This week's meals" note; "Grocery list" note | Message, then weekly schedule | **yes** | None for the core loop. Tappable list needs TASK-9/10/12 plus the group A2UI gate |
| 2 | Plan what to plant and get seasonal nudges | 1–2 + agent | Notes write; cron reminder | Planting plan note; task log | Message, then seasonal schedule | **yes** | None for the core loop. Weather is `web_fetch`-degraded; reminders are message-shaped |
| 3 | Split chores and keep household routines running | 2+ housemates + agent | Notes write; cron; **per-actor validation of "mark done"** | Chore roster note; completion log | Tap (wanted), schedule | **degraded** | Core loop is tap-to-complete: needs TASK-9 (blob edit), TASK-10/12 (card state), plus lifting the DM-only render gate |
| 4 | Keep a shared inventory of what's in the pantry | 2+ + agent | Frequent small structured mutations | Inventory note | Tap, message | **degraded** | Same card dependency as #3; text-only mutation is high-friction. Best as a meals extension, not standalone |
| 5 | Plan a trip together | 2+ + agent | Notes write; `web_search` | Itinerary note; packing list | Message | **yes** | None. But episodic — no recurring hook |
| 6 | Plan a party or event | 2+ + agent | Notes write; invite non-members | Guest list; to-do; menu notes | Message | **yes** | Inviting outsiders needs app-side lure links; the agent cannot mint them |
| 7 | Run a book club | 3+ + agent | Notes write; schedule | Reading schedule; discussion | Message, schedule | **yes** | None — a `book-club` group template and an unmerged kit already exist. Not domestic; slow cadence |
| 8 | Collect and retrieve recipes | 1–2 + agent | Notes write; `web_fetch` | Recipe notes | Message | **yes** | None. Overlaps #1; `cooking-club` template exists |
| 9 | Keep a pet care schedule | 1–2 + agent | Notes write; cron | Care schedule; log | Schedule | **yes** | None, but low generativity — the agent has little to contribute |
| 10 | Log home maintenance and get seasonal reminders | 1–2 + agent | Notes write; cron | Maintenance log | Schedule | **yes** | None, but very low frequency — no payoff inside the activation window |
| 11 | Get a morning briefing | 1 + agent | `web_search`; cron; DM | Optional digest note | Schedule | **yes** | None — this is literally the shipped nudge example. Solo, so it never exercises the shared-space differentiator |
| 12 | Follow a shared training plan | 2+ + agent | Notes write; log entries | Training plan; run log | Tap, schedule | **degraded** | Logging wants taps and health data; no health integration exists |
| 13 | ~~Coordinate a shared family calendar~~ | 2+ + agent | Read and write real calendar events | Events | Event, schedule | **no** | **Unsupported integration.** No calendar provider exists; the MCP catalog is hosting-side and empty. A notes-shaped "calendar" that does not appear on anyone's phone is a fake |
| 14 | ~~Order groceries or run errands with checkout~~ | 1–2 + agent | Place a real order; spend money | Order history | Tap, message | **no** | **Unsupported integration and unclear permissions.** No commerce integration, and no model for which member may authorize spend |
| 15 | ~~Track a shared budget~~ | 2+ + agent | Import transactions; write financial records | Ledger | Event | **no** | **Unsupported integration and unclear permissions.** No bank or receipt import; shared financial data has no per-field access model. Manual-entry version is possible but tedious and not generative |
| 16 | ~~Coordinate kids' school logistics~~ | 2+ + agent | Read school portals or parse email | Event and task list | Event | **no** | **Unsupported integration and unclear permissions.** No email or portal access; third-party and minors' data |
| 17 | ~~"Describe a little app and the agent builds it"~~ | 1+ + agent | Execute generated UI code | Arbitrary | Message | **no** | **Arbitrary generated UI.** Research prototype only (`385fbe9f0`); needs signing, sandboxing, permissions, upgrade, and recovery first. This is PLAN.md's platform milestone, not the wedge |

### Crossed off, with reasons (AC #2)

- **Arbitrary generated UI** — #17. Also any variant of #3, #4, or #12 whose value depends on more than A2UI's six components and two actions.
- **Unsupported integrations** — #13 calendar, #14 commerce, #15 banking, #16 school portals and email. Also the health-data half of #12. None of these are close: there is no first-party integration of any kind, and the MCP provider catalog lives in hosting with only a disabled entry today.
- **Unclear permissions** — #14, #15, #16. Money movement and minors' third-party data have no actor-authority model. Note that the notes read-versus-write split (group membership grants read; writing needs an explicit notebook role) is a **provisioning requirement**, not a blocker — see the findings section.

## 3. Clusters

Survivors group into four shapes:

**A. Recurring plan producing a shared list** — #1 meals, #2 garden, #3 chores, #4 pantry. Natural cadence, artifact that gets reused between sessions, agent has something to generate. This is the shape the product wants.

**B. Episodic project plan** — #5 trip, #6 party. Excellent artifacts and genuinely collaborative, but they end. No recurring hook means no retention loop.

**C. Shared library or log** — #7 book club, #8 recipes, #9 pets, #10 maintenance. Durable and low-effort, but slow: nothing meaningful happens inside the activation window.

**D. Solo digest** — #11 briefing. Recurring and fully supported, but single-player, so it demonstrates none of the invite-a-person differentiation the workspace concept rests on.

Cluster A is the only one that satisfies recurrence, collaboration, and immediate generativity at once. The hero comes from A.

## 4. Hero selection (AC #3)

Scored against PLAN.md's activation criteria. Pantry (#4) is excluded as a feature of meals rather than a workspace of its own.

| Criterion | Weekly meals | Garden plan | Household tasks |
|---|---|---|---|
| Immediately generative from zero input | **Yes** — the agent can produce seven plausible dinners before knowing anything about you | Weak — needs location, zone, and season before output is useful | **No** — the agent cannot invent your chores; requires elicitation first |
| Naturally collaborative | Yes — preferences in, shared list out, used by whoever is at the store | Moderate — usually one person's hobby | **Strongest** — chores are inherently divided |
| Visible durable artifact | Yes — two notes, immediately useful | Yes | Yes |
| Recurring without integrations | Yes — weekly, the strongest natural cadence in the set | Yes, but feedback is weeks away | Yes |
| Core loop feasible today | **Yes** — text and notes carry it; taps are an upgrade | Yes | **No** — the loop is tap-to-complete, which is the blocked capability |
| First artifact under 90 seconds | Yes | Needs a location question first | Needs elicitation first |

**Hero: weekly meals and grocery list.** It is the only candidate that scores clean on all six. The decisive factor is not novelty but that its value survives the current constraints intact: a meal plan and a grocery list are *supposed* to be documents, so shipping them as notes is the real product rather than a degraded placeholder. Everything the interactive-card work adds later (checking off groceries, swapping a night's dinner with a tap) is an upgrade to an already-complete loop, not the thing that makes it work.

This confirms PLAN.md's recommendation, and the exercise adds a reason PLAN.md did not state: meals is the only shared-domestic candidate whose core loop is not blocked by the DM-only card gate.

**Runner-up: household tasks and routines.** It scores best on collaboration and would arguably be the stronger product — but its core loop is exactly the capability that does not work today. It becomes viable the moment TASK-9, TASK-10, and TASK-12 land plus the group render gate lifts. Recommend it as the second kit, sequenced immediately after the interactive-card work, and treat it as the acceptance test for that work.

## 5. Onboarding screen 1 starter options (AC #4)

PLAN.md proposed meals, garden, household tasks. **Confirmed, with day-one framing requirements per option.** The set is right — all three are cluster A, shared-domestic, and none is crossed off — but two of them will disappoint unless their first turn is shaped around the gaps the matrix found.

1. **Weekly meals and grocery list** — recommended default, hero kit. Ships with a starter artifact generated before any user input.
2. **Household tasks and routines** — keep. Day-one requirement: the kit must open by *proposing* a starter routine from a one-tap house type (couple / shared house / family) rather than asking the user to enumerate chores, and "mark done" must be a chat reply until cards land. Revisit as the flagship demo once TASK-12 ships.
3. **Garden plan and seasonal reminders** — keep, and it has content leverage (an existing `garden-club` template and the gardening mock conversation already used in onboarding). Day-one requirement: lead with a single location question so the first artifact is specific, and set expectations that reminders arrive as messages.

Plus "Something else," as PLAN.md specifies, not as the primary path.

Consequences: **TASK-5** (interstitial 1) can build against this confirmed set. **TASK-13** (meal-planning kit) is unblocked and should target notes-backed artifacts with cards as a later upgrade, not a prerequisite.

## 6. Findings that need a decision

The matrix surfaced four gaps that were not cleanly covered by an existing backlog task.

1. **The group-channel A2UI render gate.** ✅ **Resolved — folded into TASK-10** (acceptance criterion #7, added 2026-08-19). `StaticChatMessage.tsx:148` renders cards only in DMs and strips them in group channels; `BlockRenderer.tsx:980` also nulls `a2ui` in the non-A2UI default path. Since workspaces *are* group channels, every card-based feature was blocked on this regardless of TASK-9/10/12, and TASK-10's own multi-device criterion could not be demonstrated meaningfully in a DM.
2. **The agent cannot mint invite links.** The `tlon` CLI has `groups invite <group-id> <ship>` but no lure generation, so "invite your partner" must run through app-side APIs. Affects TASK-11, TASK-16, and TASK-24 — the invitation cannot be an agent action. *Open.*
3. **Notes writes need an explicit notebook role.** Group membership grants read only. Workspace provisioning must grant the agent an editor role on the workspace notebook, or every artifact write fails. Affects TASK-16 and TASK-13. *Open.*
4. **Cron is owner-only and has no UI.** Schedules can only be created by the owner asking in DM. TASK-23 offers a recurring schedule contextually after the first result — that needs either a UI path to cron or an agent-mediated confirmation flow inside the workspace conversation, which does not exist today. *Open.*
