_Warning: a generated document_

# Can Harness replace hosted OpenClaw?

2026-11-09. Based on the inventory in this directory and the reconciled parity plan. 

## Answer

Yes, but not without first fixing Harness itself. The runtime core is already at parity or better. What is missing is product behaviour that today lives in the OpenClaw plugin and the tlonbot wrapper, plus a handful of Harness defects that no hosted deployment can carry. With agent-driven development and no human code review, neither code volume nor review bandwidth is the constraint. Live verification on ships, calendar-bound soak and upgrade testing, decision latency, and a few scope choices are. An employee trial is reachable in three and a half to four weeks. Production parity for external users is about three months from today in every scope variant, two and a half at best and five at worst.

## Why it is feasible

- Harness already has providers (OpenAI, ChatGPT OAuth, Anthropic native, xAI, OpenRouter with ZDR, ordered fallbacks), LCM compaction, structured memory with dreaming, cron, subagents, web search, an MCP client, and Context Lens sync to Steward.
- Its native `tlon` tool covers nearly every CLI command group when acting as the bot ship. The workbench already passes 79 of 120 cases.
- Steward is the app's protocol boundary and is harness-agnostic. Implement the bot side faithfully and the Messenger screens work unchanged.
- Hosting already provisions Harness bots, pushes model defaults and permissions, and has the pool switch. Groups' logs agent already forwards events to PostHog, so telemetry needs event names, not an exporter.
- About 13k lines of `tlawn.py`, a 2k-line SSE client, upstream patching, and canary tooling have no counterpart to build. Most of it exists to tame OpenClaw versions.
- Calibration: Harness itself is 53k lines of Hoon written in ten weeks by a small team working with agents, and nobody has read it.

## What stands in the way

Parity is mostly ordinary build and verification work: the shared channel session, approvals, Steward adapters, onboarding, and running all of it against a real owner Steward for the first time. The width of the estimate ranges comes from scope and sequencing choices rather than technical unknowns: full or pragmatic scheduler delivery, owner-grant policy A or C, how long the soak runs, and whether every decision the audits list is taken in week one. Migration of existing bots used to be the biggest lever; without a review bottleneck it changes effort and risk but barely changes the date. Owner identity is already decided in the plan (a sidecar), shared sessions are already a decided redesign, and the dashboard's settings keys are moot because hosting pushes permissions through Harness's own endpoints. The row audits list the smaller decisions that block each track.

Independent of parity, Harness has defects a hosted bot cannot ship with. Owner DM conversations ignore tool grants. The hand ledger stops accepting messages at 256 per conversation and 2,048 per ship, and only a manual export-and-retire frees it. History is never pruned, and the turn, transport and native benchmarks that exist have never been run and recorded, so no measured figures exist. A run of bots answering each other stops after three bot messages in a conversation, but only while the 128-entry activity feed remembers the run; there is no DM bot-loop guard, no spend cap, and a conversation whose retained history alone is too large for the model stays stuck. The suite went green on Nov 6, against a fake model only.

## Estimates

Assumptions: agents implement with effectively unlimited tokens and run continuously, so one stream lands about seven agent-days a week; four to six streams run in parallel; nobody reads the Hoon. Each PR carries a docs-refs change and tests named for the invariant they enforce, gets an adversarial agent review against a written invariant list, and is accepted by `just test` (minutes for a pattern, 37 minutes full), the tlonbot workbench (90 to 150 minutes serial, shardable, real model, local Docker ships), and live two-ship checks where a row needs them. Humans spend about 30 minutes per PR reading the docs-refs and test changes, make product decisions, and keep reading code only in ylem (TypeScript and Haskell) and in the owner sidecar. Wall-clock is in working weeks; decisions, human reads, fleet deploys and live acceptance happen on working days. Figures are the likely wall-clock after re-costing; agent-days are in the appendix.

| Stream                     | Scope                                                        | Likely wall-clock                                            |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Decisions                  | The scope choices above plus the per-track decisions in the audits | Week 1, in parallel with everything else. Now directly on the critical path: a late decision adds its full slip |
| Harness defects            | Owner grants (DM-only, decision A), hand-ledger rotation, loop guard, upgrade test | About 1 week for the trial subset; 1.5 with archival and benchmarks |
| A1: Steward integration    | Automations and prompts adapters, schedule change feed in the head, fixed-offset timezones so app creates succeed, lease and configure decoupled from Lens, `bot-info`, lens tagging, two-ship verification | About 1.5 weeks, bounded by the live two-ship check against a real owner Steward |
| A2: Scheduler and delivery | Pragmatic: tz table, `every`, unlimited runs with retention, enabled toggle, delivery via the `tlon` tool. Full: receipt-backed delivery to any nest or notebook and failure destination | 1.5 to 2 weeks pragmatic; 2 weeks full; both after A1        |
| B: Shared channel session  | Stage 1: silent reply in the hand, channel history, owner-listen rule. Stage 2: speaker-keyed tool lookup, session key, binding fix, grants separate from routes, speaker prefix, suite rewrite | 1 week stage 1; 2.5 weeks total                              |
| C: Approvals               | Approval cards, block list, DM invites, owner commands in the adapter, replay rule; cards already render in the app | 2 weeks, bounded by six decisions and merge serialisation with B |
| D: Rest                    | PostHog names through `%logs`, browser secure-entry card and continuation, additive skill sync, inbound images by URL, the single state migration | 1 to 1.5 weeks of its own work; the shared state migration merges after B's state change, so the row closes with B |
| Hosting                    | Trial-enabling: pool, source ship, desk build CI, update push, rollback. Then owner sidecar, browser MCP registration, default task | 1 to 1.5 weeks trial-enabling, gate-bound; about 3.5 weeks full with a human security review of the sidecar, bounded by A2 and B landing |
| Eval loop                  | Workbench CI against the fork (install script fix, sharding), triage rerun, two-speaker transport and B/C fixtures | About 1 week; fixtures 1 to 2 days after each track merges. Starts first: the fixtures are the acceptance mechanism for every other row |

The tiers below are the same work at three scopes.

| Tier                                  | Includes                                                     | Likely wall-clock        |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------ |
| 1. Plan's scope landed on the fork    | Tracks A1, B, C, D as the parity plan defines them, with fixed-offset timezones; trial-enabling hosting; eval CI | 2.5 weeks (bounded by B) |
| 2. Trial employees can live on        | Tier 1 plus the defects subset including ledger rotation, and one stabilisation pass against live bots | 3.5 to 4 weeks           |
| 3. Trial with no accepted limitations | Tier 2 plus pragmatic A2, archival rollover, measured performance, full hosting with the sidecar | 4 to 5 weeks             |

Beyond the trial, for external users. The trial begins once Tier 2 is done, three and a half to four weeks from today, and the items below are timed in weeks from that point. Several of them land while the trial is running; those off the critical path are given as the trial week by which they are ready.

| Work                                                         | Likely                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| A2 lands                                                     | By trial week 1. It starts after A1 and finishes around trial start, plus contention with the stabilisation pass and trial-found defects |
| Onboarding: cards, provisioning coordinator, completion flag, skill, read-only MCP policy | 1 to 1.5 weeks after A2; 8 of its 16.5 agent-days are built during the trial |
| Campaign and nudges                                          | 0.5 to 1 week after onboarding; the library is built during the trial; heartbeat is internal-only and off the path |
| Credits and budget hold, memory audience scoping, Story codec, remaining tool gaps | Ready by trial week 4 to 4.5, on parallel streams; under 1 week for credits if Pioneer pushes a free primary through `hosted-provision` |
| Migration of existing bots                                   | Exporter and memory conversion during the trial; LCM target after the archival decision; ready by trial week 3.5 to 4.5. Memory files only: by week 2 |
| Integrate and freeze state                                   | 0.5 to 1 week, once every item above has landed and its docs and tests have been read; trial week 4.5 to 5.5 at full scope |
| Populated-ship upgrade test and 2-week soak at fleet-like history | 3 weeks, calendar-bound                                      |
| One fix and rerun                                            | 1 week, calendar-bound                                       |

Production parity: eight and a half to nine and a half weeks after the trial begins at full scope, about three months from today. The soak, upgrade test and rerun are four weeks of that in every variant. Before them, the freeze at full scope waits on the parallel streams landing and on humans reading their docs and tests, about four to four and a half trial weeks; the A2-onboarding-campaign chain itself finishes by trial week 2.5 to 3.5. With the three cuts, or with new users only, less lands before the freeze, the chain binds instead, and the freeze can come about a week earlier, at the cost of a week less trial feedback before it. Either way the answer is about three months. Best case is two and a half months, if the chain lands at agent pace and the soak passes first time. Worst case is five months, if PRs have to be cut small enough that human reading becomes the bottleneck again, if Pioneer cannot start its part by trial week six, or if the soak finds a state-changing defect. Migrating existing bots or not is an effort and risk decision, not a date decision.

## Risks

- Nobody reads the code, so acceptance is tests, the workbench, the trial and an agent review against named invariants. The failure mode is a silent pass: a defect in trust or cutoff logic survives if no test names it. The property lists in the four re-costings are the minimum test set, and the cross-row test of an approved stranger entering a shared session under their own ceiling is the seam no single row covers.
- Nobody can debug the Hoon in production either. `docs-refs` has to be treated as the spec and every incident fixed by agents against it. This is a standing cost of the replacement, not a one-off.
- Human reading of docs and tests still caps throughput at roughly six to seven agent-days a day. If PRs shrink to one agent-day to stay readable, the old review bottleneck returns.
- Decision latency is now exposed. Review backlog used to hide it, because work queued behind reviewers anyway. A decision not taken before its consumer starts adds its full slip to the path.
- Verification infrastructure gates every stream. Four to six streams at two sharded workbench runs per PR need 25 to 40 runner-hours a week, or several Docker hosts. A single workstation sets the worst case.
- Merge serialisation has no human arbiter. The state-3 migration, admission code in the Tlon adapter, and the hand ledger are each touched by two or three rows at once. Each needs a single owning stream or every collision costs a rebase, a full suite run and a re-review.
- The plugin moved 513 commits in October. Parity is a moving target unless the plugin is frozen for the trial.
- The owner sidecar holds the owner's login code and the prototype has no authentication. It is the one component that keeps a human security reader, and its host is undecided.
- Harness has never run against a real owner Steward. The first two-ship verification will find things, and that is human and calendar time.
- Memory privacy for non-owner speakers is unresolved and the trial plan loosens it.

## Recommendation

Proceed with the employee trial on the plan's four tracks, with the Harness defects, hand-ledger rotation and the silent-reply change added to the first two weeks. Start the eval row first, since its fixtures and the conformance suites replace the code reader; every PR adds tests named for the invariant it enforces and a docs-refs change, and those are what humans read. Give the state-3 migration, the Tlon adapter's admission code and the hand ledger one owning stream each. Keep a human reader on the sidecar and the ylem diffs. Take the week-one decisions in week one. Freeze the plugin's feature work for the trial window. Decide on replacement only after a Harness bot passes the fixtures with a real model and has run at fleet-like history sizes for two weeks.

## Appendix: how the final time frames were reached

Eight audits, one per estimate row, each itemised the work at file level in both repos, counted agent-days (best, likely, worst) including tests, and converted to wall-clock given verification cycles and human review at two to three hours a day. Where an audit contradicted an earlier report, the claim was checked by hand.

The audits were then re-costed under the assumption that no human reads the code. Agent-days did not change; only the conversion to wall-clock did. There are four re-costings, one per group of rows. Each gives the share of the old figure that was human diff review, the new critical path, what sets the cadence now, and the properties no human will verify with the test or agent-review check that stands in for each.

### What replaced code review

- Human diff review was modelled as the throughput limit: three to four agent-days of output reviewable per working day, shared by every stream, plus explicit review rounds on security-relevant rows. Row by row it was rarely on the critical path; defects, A1, B and C were bound by their serial paths. Program-wide it was the cap: about 100 agent-days of trial-window diff at that rate is five to seven weeks of review, and the post-trial figure leaned on it most, about 40% of the 14 to 16 weeks.
- The new model costs each PR at 0.25 agent-days of adversarial agent review plus one verification cycle for fixes, about 0.3 days on a stacked path, and costs every merge collision on a shared file at half a day. It keeps decision latency as the audits gave it. It keeps human code review for ylem, whose author can read it, and for the sidecar, which holds an owner credential.
- The net effect is small inside the trial window and large after it. Trial-window rows move by zero to half a week, mostly because agents also work nights and weekends. The post-trial path drops from 14 to 16 weeks to 8.5 to 9.5 because its three review-paced segments, A2 landing, onboarding and campaign, were nine to ten weeks and are now one and a half to three and a half, while the four calendar-bound weeks of soak, upgrade test and rerun do not move.

### Harness defects

Audit: 1.5 weeks for the trial subset, 2.5 to 3 with archival and benchmarks. Without code review: about 1 week and 1.5 weeks. Agent-days: 13 subset, 25 full, plus 3 to 4.5 of review and fix cycles.

- A cap nobody had listed: the hand ledger holds 256 observations per binding and 2,048 per ship, and only a manual retire frees it (`harness-hand.hoon:253-260`, `hands.md:210`). Verified.
- The owner bypass is narrower than ISSUES.md says. `harness-admin.hoon:43-48` grants it only for the owner's own DM, ACP and local pokes, never channels. Keeping the bypass and fixing the docs is one day.
- Archival should wait for benchmark numbers. The scripts exist; a 10k-event seeder and recorded results do not.
- Review was never on this row's path; its pole is one serial six-agent-day item. The cadence is now merge serialisation on the hand ledger with A2 and on adapter state with B and C. No live owner Steward is needed.

### A1 Steward integration

Audit: 5 to 8 working days. Without code review: about 1.5 weeks. Agent-days: 10, plus about 3 of review and fix cycles.

- Steward messages are small; the cost is on the Harness side. The head has no schedule change feed to project from. `delivery.to` needs resolving to an existing owner binding. Owner `%configure` is Lens-gated like the lease.
- The app always sends the device timezone on create, so rejecting non-UTC kills the Create button. Fixed offsets must ship with A1.
- Pause maps to cancel and cannot resume. The 100-run cap kills an hourly task in four days.
- Only SOUL.md and IDENTITY.md are editable in the app, so the prompt mapping shrinks.
- The row does not shrink because it was never review-bound. It is bound by the live check: two ships on a groups desk at 12.5.0 or newer, a fake planet owner with a fake `~pinser-botter-` moon so the app finds the bot, a real owner Steward, and a dev Messenger build. Fixes can only start once that has run.

### A2 Scheduler and delivery

Audit: 2.5 weeks pragmatic, 3.5 full, 3 days minimum. Without code review: 1.5 to 2 weeks pragmatic, 2 weeks full, 2 days minimum. Agent-days: 13.5 pragmatic, 22 full, plus about 5 and 7 of review and fix cycles.

- The only row visibly stretched by review: the audit paced 13.5 agent-days on two streams over 12.5 working days, about a week of which was review and merge gating.
- Notebook delivery is a new publication kind through `%notes` with its own receipt, not a re-route. Results today always return through the source lane.
- Unlimited runs need retention. Run sessions and receipts are never pruned, and `busy` scans them.
- The migration touches all five historical state shapes and needs the repo's first populated-ship upgrade test.
- Fixed offsets are safe until the March 2027 DST change. The minimum variant held.
- Cadence is now merge serialisation on `harness-schedule.hoon` and `harness.hoon`, then the week-one decisions. Delivery through the `tlon` tool needs the model to actually call it, so acceptance is real-model workbench runs, not the fake model.

### B Shared channel session

Audit: 3 weeks, stage 1 in 1. Without code review: about 2.5 weeks, stage 1 still 1. Agent-days: 22, plus about 4 of review and fix cycles across eight PRs.

- Three head-level pieces were missing. Bindings carry a fixed speaker list and refuse changes (`harness-hand.hoon:384`). Schedule tool checks follow whoever spoke last. The ledger cancels per session, not per message.
- Silent reply is cheaper than feared. The hand can recognise it and mark the publication delivered with nothing sent, about 1.5 days, preserving the ledger and Lens invariants.
- Stage 1 (silent reply, channel history, owner-listen, eviction) is independent and must precede owner-listen, or the bot answers every owner post.
- No critical-path item was review; the three or four review rounds fit inside the daily budget. The half week saved is continuous agent time less about two and a half days of adversarial review and integration with C. Best and worst do not move.
- The invariant that matters most, no non-owner speaker in a shared session reaches owner tools, needs a fourth fake ship in `scripts/test.sh` and a new two-speaker conformance suite, since the workbench has no two-speaker group-channel transport yet.

### C Approvals

Audit: 2 weeks. Without code review: 2 weeks, unchanged. Agent-days: 11, or 9 without the loop guard and memory gate, plus about 3.5 of review and fix cycles across seven PRs.

- The card-version question is closed. Harness cards pass the app's own validator in a scratch vitest run, and the v2 constant was a rename with no schema change.
- The work reverses a deliberate product rule (silent ignore, tested by `tlon-denial-conformance`) and adds two paths the adapter never had: posting outside a turn, and owner commands that change adapter policy.
- Approving a stranger drops their original message unless grant cutoffs get a scoped exception.
- The loop guard was double-counted with the defects row. Approvals push against the 64-ship list cap.
- The audit's one to two days of human revision rounds come out and about the same goes back in as adversarial review and integration with B, which edits the same admission code and wants the same state-3 migration. Six decisions gate most of the row and are now the first thing that sets its cadence.
- The inverted denial suite and the rewritten authority section of `docs-refs/tlon.md` are the only point where a person confirms the new contract, so every test name has to state its invariant.

### D Rest

Audit: 1.5 to 2.5 weeks. Without code review: 1 to 1.5 weeks. Agent-days: 14.5, plus 1.25 of review.

- Images are not the long pole. Pass the public image URL to the provider instead of downloading. Every route Harness uses accepts URLs, about 5 agent-days, no `%storage`, testable on fake ships. The Anthropic codec passes arrays through verbatim and must translate.
- PostHog needs no exporter. Groups `%logs` already posts to PostHog (`ted/posthog.hoon`) and Harness emits through it. What remains is event names and properties, plus a decision about whose project and which ship is the person. Fake-ship tests currently send events to production PostHog.
- Browser continuation reuses the idempotent re-admit the lens retry already uses.
- About three of the audit's ten days were review queueing. The tail is the single state migration, which cannot merge before B's state change lands, so D's end is the later of its own path and B plus a day and a half.
- The migration is where a human reader would have mattered most: the current load arm builds new state from a bunt and copies fields one by one, so a forgotten field becomes empty and nothing fails. The stand-in is a populated-ship upgrade check that asserts seeded values by value, and an agent-review table listing every old and new field with its source.

### Hosting

Audit: 1 to 1.5 weeks trial-enabling, 3 to 4 full. Without code review: 1 to 1.5 weeks trial-enabling, unchanged; about 3 weeks full with no human review anywhere, about 3.5 with a human reading the sidecar and the ylem diffs, which is the recommendation. Agent-days: 19.5, plus 3 of review.

- The pool, provisioning push, permissions and onboarding endpoints exist in ylem. `%harness` reaches a moon by `kiln-install` from a source ship, and one commit there is the update push. No source ship or CI exists; the Harness repo has no `.github`.
- Every tracking moon updates at once, so canarying needs a second source. Rollback breaks across state versions.
- The no-review assumption rests on nobody understanding the Hoon, and that reason does not hold for ylem. Pioneer and Solaris are Haskell, the sidecar is TypeScript, and their author can read them. Pioneer runs in every pod including OpenClaw bots, so a bad deploy has fleet-wide blast radius.
- The trial-enabling path is bound by GCP access, secrets, Horizon admin and a staging operator for the rollback drill, not by review.
- The owner sidecar is the long pole: placement undecided, prototype unauthenticated on port 8090, and safe to expose to non-owner speakers only after B stage 2, because `hosted-provision` grants every enabled MCP server to the default tools.
- Pioneer passes nothing to `hosted-soul` or `hosted-skills`.

### Eval loop

Audit: 1 to 1.5 weeks for CI and triage; B and C fixtures 2 to 3 days after each track merges. Without code review: about 1 week; fixtures 1 to 2 days after each track merges. Agent-days: 11.5, plus 1.5 of review.

- `harness-install.sh` still calls `zig build`; Harness now uses `just build`.
- CI can run Docker ships plus a real model, as the OpenClaw smoke job already does. A full run is 90 to 150 minutes serial and up to 12 hours if everything times out, so shard three or four ways.
- Track B fixtures need a two-speaker group-channel transport that does not exist. The 41-failure list has to be regenerated.
- The runner overwrites the desk's prompt with tlonbot's copy, so CI tests tlonbot's prompt rather than the fork's. Under the new model this is a silent pass in the acceptance mechanism itself and has to be fixed before CI results count.
- The row's role changes: the workbench and `just test` are now the only acceptance for every other row, so it starts first and its runner capacity gates all streams' fix cycles. Any PR that adds to the quarantine list or lowers a grader threshold has to be flagged as a test change so it falls inside the human's read.

### Beyond the trial

Audit: 14 to 16 weeks after the trial begins, which is when Tier 2 is done. Without code review: 8.5 to 9.5 weeks, so about three months from today. Agent-days: about 125, including 15 to 25 unlisted.

- About 40% of the audit's figure was human diff review. It held each row to about one agent-day per stream per working day, and splitting a row across streams gained nothing. The three review-paced segments were A2 landing at trial week 3 to 6, onboarding at 3 weeks and campaign at 2; at agent pace they are by trial week 1, 1 to 1.5 weeks and 0.5 to 1 week. At full scope the freeze then waits on human reading and the parallel streams rather than on the chain.
- About 4 weeks are calendar-bound and do not move: the 14-day soak measures behaviour over elapsed time, the upgrade test runs only after the freeze and reruns after any later state change, and a fix repeats soak time.
- Migration has no cheap path. The corpus is built only from Harness's own logs, so an imported `lcm.db` has nowhere to go without a design. MEMORY.md is split into 1 KiB facts by `acp/import-openclaw-memory.mjs`, which reads the copy in Steward over HTTP ([usage](docs-refs/context-and-memory.md#importing-an-openclaw-memorymd)); the dated notes in `memory/` are not imported. An exporter is needed in the pod for the rest. The Hermes importer was 80 lines of SQLite-to-SQLite in one pod and does not transfer. Under the new model it is ready by trial week 3.5 to 4.5 and no longer sets the date.
- Plugin sizes in report 04 were low. The onboarding coordinator is about 4,900 lines; nudges about 1,240 plus tests.
- The soak needs a history seeder and loom measurement before it can start. Build them in trial weeks 1 to 3 so the upgrade run starts the day of the freeze.
- Human reading at 30 minutes per PR allows about six to seven agent-days of underlying work a day, twice the old cap. At the likely PR size of 1.5 agent-days it ties with the build chain for the freeze date; at one agent-day per PR it is the old bottleneck again.
- Pioneer work does not compress with agents: credits probe, switchover and rollback, ring rollout and the health probe run during the soak and must finish by its end. If Pioneer cannot start by about trial week 6, Pioneer sets the date.

How the tiers follow. Tier 1 is bounded by Track B at two and a half weeks, with A1, C, D, trial-enabling hosting and eval CI finishing inside it, and D's migration tail landing with B's state change. Tier 2 adds the defects subset in parallel, then one stabilisation pass against live bots, which is calendar time. Tier 3 adds pragmatic A2 after A1, archival rollover and benchmark runs, and full hosting with the sidecar after B stage 2. The post-trial critical path runs A2, then onboarding, then campaign, then a state freeze, then the upgrade test and soak with one fix-and-rerun, with migration, credits and memory scoping alongside.

Three corrections to earlier documents follow from the audits. ISSUES.md and report 06 describe the owner grant bypass as covering all owner conversations; it covers owner DMs and owner-driven ACP or local pokes only. Report 05 says PostHog needs an exporter; the Groups logs agent already is one. The previous version of this memo gave two and a half to three months for the new-users-only variant; the after-trial audit could not produce that figure under its own review assumption, since that path still ran A2, onboarding, campaign, freeze and soak, and it becomes right only under the no-review model.

Where the audits moved numbers down as well as up: inbound images (URL pass-through instead of download), silent replies (hand-level), PostHog (existing sink), skill sync (existing ACP delete), the card format (no work), the owner grant fix under decision A (one day), and everything after the trial once human diff review came out of the model. Where they moved numbers up: every row that touches the head's binding or schedule model, anything that has never been run against a real owner Steward, migration effort, and the soak.