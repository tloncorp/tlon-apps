# Handoff: Surface Channels v0 — Fix Round (post-Session-5 findings)

You are continuing work in `tloncorp/tlon-apps` on branch `patrick/mini-app-mvp` (public draft PR #6380 — commits are team-visible as they land). This round is **corrective only and sharply bounded**: it dispositions the Session 5 review findings that gate `--preserve-state` and Session 6, fixes the verified sync/CI defect classes, and rewrites the containment claims to match the delivered mechanisms. No new features, no templates, no fork.

Governing documents:

1. `surface-channels-plan.md` (on the branch — canonical). Amendments this round makes to it are specified inline below.
2. `DECISIONS.md` (through D76). The item-1–4 investigation results (transport verification, the SSE tee, D76's writer analysis, the CI scoping) are recorded there; read them before touching the corresponding code.
3. `surface-channels-session5-consolidated-report.md` (provided alongside) — findings are referenced below by its numbering (§2 findings 1–10, §3 validation review). Per its §6 constraint, containment-relevant specifics live in the repository alongside the code, not in reports; keep it that way.
4. This prompt — scope, sequencing, process.

## Three rules that frame every fix in this round

1. **Every High has an incident fix and a class fix; the class fix is the deliverable.** Patching the instance while the class stays armed is how this round's findings happened.
2. **A check that passes in your environment has not been shown to pass in CI's.** Verification environments must match the real one, or the difference must be argued in `DECISIONS.md`.
3. **No control is accepted without a demonstration that it can fail.** Every guard, test, lint rule, or CI job in this round lands with its negative control or fails-by-construction case — pre-fix failure demonstrated, or a mutation shown to be caught. A control without one is a claim.

## Scope, in order; each step = tests green (including the negative control) before the next

1. **Finding 2 + the class (raw-vs-validated divergence): `duplicatesTolerated` becomes a proper optional boolean on `SurfaceActionSchema`.** Additive; raw persistence already carries it; the gate's raw-read becomes redundant belt-and-suspenders rather than load-bearing. Then audit **every** raw-vs-validated comparison site (`decideRevision`, the post-write confirmation, any other spec comparison) and add the regression test that failed pre-fix: republishing an identical `append`-marked spec reports `changed: false` and does not bump. This is the fourth appearance of this class (D72, finding 2, the predicted fork hazard); the schema field is the class fix — individual comparison-site patches are not accepted as the resolution.

2. **Finding 1 (preserve-state stranding): three fixes plus taxonomy.**
   - Align the caps: snapshot `state` cap raised to 128 KiB, matching reduced state — a legal state must always be snapshottable. Update the §7 caps table on-branch.
   - Publish reorders to **validate-everything-before-writing-anything**: on a preserving revision, the migration snapshot is computed and validated _before_ the description cell moves. The pending window cannot open on a transition that is doomed to fail.
   - Un-invert the standalone-snapshot guard: `surface snapshot` at a pending revision is the **recovery action** and must be permitted (host-only, current-revision, as ever); the current refusal forbids the only repair.
   - Error taxonomy: command failures distinguish "your files are wrong" from "the system refused; your files are fine; do X" — and `SKILL.md`'s failure guidance is corrected to match, so the doctrine stops attributing system refusals to the author.
   - Negative controls: the pre-fix stranding sequence (legal 64–128 KiB state, title-only preserving revision) reproduced as a failing test before the fix, passing after; the recovery path proven from an artificially stranded channel.

3. **Finding 3: `surface snapshot --up-to N` folds only events with `sequenceNum ≤ N`.** The pre-fix duplication (two appends, `--up-to 1`, replayed sequence 2) is the failing test.

4. **Finding 4 + semantics amendment: cap-refusal aborts the remaining ops in the entry.** Amend the reducer: an op refused for a **resource cap** (state size, depth) aborts the rest of that entry's ops — deterministic and convergent, since all clients hit the cap at the same fold position. Grammar-invalid ops (bad pointer, `$actor` misuse) keep skip-and-continue: they are author errors, not environmental conditions, and the distinction is the point. This is a ratified-semantics change: land it as an explicit amendment to plan §7 on-branch, with property tests covering both refusal kinds and the pre-fix data-loss sequence (near-cap rollover: archiving `set` refused, `del` no longer applies) as the negative control. `PARADIGM.md`'s rollover section keeps the softer doctrine rule ("no destructive op whose safety depends on a preceding op succeeding") but no longer stands alone against the failure.

5. **Finding 7: observation must prove a _new_ write.** `postSurfaceRecord` success requires the observed post's host-stamped identity to postdate the pre-write head (sequence advanced past the recorded pre-state), not an author/`sentAt`/blob match. `surface create` verifies the name it _actually assigned_ — including the ninth-candidate path — against both `%groups` and `%channels` before reporting success. Negative controls: a matching pre-existing post + silent no-op must now report failure; a create no-op must not report the requested title as stored.

6. **D76 (the sync-writer class): both mechanisms, exactly as ruled.**
   - Switch `insertGroups` to the `conflictUpdateSetAll($channels, [exclusions])` pattern. The exclusion list is **reasoned from an explicit audit** of which columns group sync is authoritative for versus client-local — **not cloned from `insertChannelsInternal`** (cloning reproduces the defect sign-flipped inside a correct-looking shape). Record the per-column classification in `DECISIONS.md`. The `iconImageColor`/`coverImageColor` instances are fixed by the switch; extend the spec-convergence test to assert them both directions.
   - The pin test: `getTableColumns($channels)` asserted equal to the union of setAll coverage and exclusions, so the next added column fails loudly and forces a conscious classification. Demonstrate it fails on a synthetic unclassified column.
   - Non-blocking guard test for the live path: `r-channel` edit fact → `toClientChannel` → `db.updateChannel` carries `description_payload`/`surface_spec` (currently correct by reading, unguarded).
   - `DECISIONS.md` entries: the write-ordering dependency the D59 fix introduced (forced `syncGroup` rewriting columns after `updateChannel`; symptom if `%groups` ever emits before updating state: a metadata edit visibly reverting seconds later), and the item-(a) host-ness inference (immaterial by signature on the touched paths; remote delivery is pre-existing `%groups` machinery; the remote-admin scenario is a Session 6 seed upgrade).

7. **Finding 10 + the CI class.**
   - Both jobs get the browser-flagged preview leg: `bot-checks` (which also needs the missing `build:surface-shell` step — `surface-preview.ts` imports the gitignored `dist/`, so `tlon-skill` typecheck fails on any clean checkout today) and `test-build`. They are mutually exclusive per PR, so no double cost.
   - Classify `packages/surface-shell/**` into **both** path filters — the shell has both consumers, and a shell-only PR must never run zero CI.
   - The class fix, small: a CI script asserting every workspace package appears in the union of the workflow's path filters — the pin test's analogue for `ci.yml`. Demonstrate it fails when a package is removed from the filters.
   - Per rule 2: verification of the CI changes must be against the workflow's actual gating conditions and this branch's changed-path set, not a local run — state in the report which jobs run on which PR shapes, with the condition lines cited.

8. **§3 items: the gate's claims and the cheap widenings.**
   - **Wire the fixture's existing click method into the behavioral phase** — every declared action's control is activated during the smoke render. This widens rule 5, `chart-sizing`, `jargon`, and `smoke-render` at once, and it fixes finding 6's oracle at the root: the chart rule's assertion moves to the _live instance_ (`options.responsive === true` on charts observed after interaction, constructed through the primitive) — the attribute-absence oracle is factually wrong, since real Chart.js sets canvas `width`/`height` itself.
   - Model the missing platform API and the two markup routes recorded in the repo; narrow the `location` pattern to the member form; stop `open` firing on declarations. Pre-fix false-positive fixtures (a potluck app with a `location` field; a modal `open` function) become passing tests; the newly modeled routes get failing-bundle fixtures in the gate self-test suite.
   - **Rewrite the claims**: rule 5's docstring and plan §5 on-branch. Rule 5 is a fail-fast lint that catches naive spellings. On web, pre-flight containment is the host-page `frame-src` allowlist; structural containment is the M4 Worker realm. Nothing in the gate is a boundary, and the docs stop saying otherwise.

9. **Host-page CSP: listener, then the flip decision line.**
   - Wire the `SecurityPolicyViolationEvent` listener on the host page, feeding telemetry under the F6 rules (enum'd disposition + truncated/hashed `blockedURI` — attacker-controlled content never reaches telemetry raw). Negative control: a synthetic violation in the dev harness produces exactly one bounded event.
   - Verify Report-Only on the dev/preview servers surfaces the synthetic violation end to end.
   - **Decided (Patrick, this round):** `ENFORCE_HOST_CSP` flips to `true` in this round, after the listener lands and the posture suite passes under enforcement on all three engines. Both are hard preconditions on the flip, not adjacent tasks: once enforcing, failures are silent in production (D44 — `report-uri` is unavailable in a `<meta>` policy, and `tlon-web` ships as a `%docket` glob with no header path), so the in-page listener is the only violation signal that exists. A flip landing without it is a flip with no instrumentation.

## Explicitly OUT of scope

- Findings 5, 6 (beyond the oracle fix in step 8), 8, 9 — Session 6, adjacent to the template work that exercises them.
- D69/D70 (preview's `preserveState` and host-event gaps), D74 (Hermes doctrine reachability — candidate fix is doctrine-via-CLI commands), the dev-storage publish path, `surface fork`, the seven templates, the eval harness, countdown's disposition — all Session 6.
- The Worker-realm migration (M4), native device work, provisioning items.
- Any semantics change not named here. Defects found get reported with evidence, not fixed opportunistically.

## Process rules (carried forward)

- **The plan wins over your instincts; reality wins over the plan** — and this round amends the plan in four named places (§5 claims, §7 caps, §7 semantics, and the docstring-adjacent language); apply those amendments as part of their steps, nothing else.
- Append to `DECISIONS.md` (continue from D76); run every check unpiped; claims cite probe lists; sqlite ABI and Metro stale-bundle gotchas stand.
- The branch is public: commit messages are audience-facing; the report notes whether the PR head advanced.
- Security invariants: all prior, plus — telemetry never carries raw sandbox- or violation-derived strings; observation-based success semantics are never weakened to make a test pass.
- Small commits per step; no drive-by refactors.

## Definition of done

- Steps 1–8 landed in order, each with its negative control demonstrated (pre-fix failure or synthetic-mutation catch) and recorded in the step's tests.
- Step 9 per the retained decision line.
- Plan amendments applied on-branch (§5 claim rewrite, §7 caps table, §7 cap-refusal semantics); `SKILL.md`/`PARADIGM.md` corrections from steps 2 and 4.
- Full branch green + typecheck clean everywhere, **including `pnpm --filter tlon-skill check` on a clean checkout** (the dist/ defect's own negative control).
- `DECISIONS.md` appended: the column classification, the write-ordering dependency, the host-ness inference, CI job/PR-shape matrix, and any judgment calls.
- A per-finding fix-diff summary (files touched, one paragraph each, negative control named) as the input to the split re-verification passes, which run after this round and are planned as split from the start.
