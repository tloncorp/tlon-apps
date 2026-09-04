# Sol cold review — findings, verbatim

**Round:** the first cold review of the delta since the fix round
(`d5c41acdc5..HEAD`, 87 files in the shipped surface path and the gate, plus 34
doctrine/template files as a bounded secondary read).

**Model:** `gpt-5.6-sol`, xhigh reasoning, read-only sandbox.
**Reviewed at:** `c85f0ee4c2`. **Cost:** 974,595 tokens, ~31.5 minutes.
**Brief:** `surface-channels-sol-review-r4-brief.md`.
**Raw log:** `sol-review-r4.log` (4.97 MB, untracked, local only).

This file is the reviewer's own words, unedited, because the raw log is
untracked and 5 MB and a summary of a finding is not the finding. Dispositions
are NOT here — they go in a separate document once decided, following the
precedent of `surface-channels-review-dispositions.md`.

**A note on the run that preceded this one.** An earlier attempt with the same
brief was refused by a provider classifier after 285,641 tokens with no report
emitted (`sol-review-r4-refused.log`). That brief excluded browser-sandbox
containment in prose while leaving `sandbox-posture/` and `hostCsp.ts` in the
review target, because the reviewer needed them to judge the test harness.
Reading the material is what trips the classifier, so the re-run removed those
paths outright. One finding survives from the refused run and is NOT in the
report below, because it was never emitted as one — from the reviewer's
narration:

> "the CLI reducer calls omit the channel's advertised head, which can turn a
> deliberately rejected future-covering snapshot into accepted compaction"

Verified independently: `advertisedHead` appears zero times in
`packages/tlon-skill`, so the D175 guard is client-only. A snapshot the client
refuses as future-covering is accepted by the CLI, which can then fold from it
and write a fresh snapshot — laundering the bad boundary. Track it alongside
the findings below.

---

Verdict: **not yet safe for preserving live state**. I found two High state-integrity failures, including one route to cross-client divergence and one route to overwriting a concurrent revision.

## Findings

1. **High — hydration discards duplicate-sequence posts before the reducer can apply its deterministic tie-break.**

   `getSequencedChannelPosts` orders only by `sequenceNum`. On rows `7/A, 7/B, 6, …`, it accepts the first 7 and treats the second 7 as a gap because it expects 6 next. Subsequent paging uses `sequenceNum < 7`, permanently excluding the other post. Hydration can nevertheless see head 7, load through sequence 1, and return `hydrated`. See [queries.ts](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/db/queries.ts:3770), [hydration.ts](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/store/surface/hydration.ts:139), and the non-unique index in [schema.ts](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/shared/src/db/schema.ts:1340).

   Thus the D174 ordering in [reducer.ts](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/client/surface/reducer.ts:232) never sees both rows. Two clients with the same posts but different SQLite insertion order can fold different writes.

   **Verification:** source-traced and reproduced the SQL premise in in-memory SQLite: opposite insertion orders returned `a,b,c` versus `b,a,c` under `ORDER BY sequence_number DESC`. I did not run the full DB/hydration integration.

   **Negative control needed:** insert conflicting same-sequence posts in opposite orders into two databases, hydrate both, and require both rows to reach the reducer and the canonical higher ID to win. Pagination needs a tuple cursor/order, or otherwise must retain every row sharing a sequence.

2. **High — the new loss-prevention guards are stale check-then-overwrite checks, so concurrent writes bypass them.**

   Three paths read a channel, perform asynchronous work, then submit a complete stale channel value with no conditional update:

   - `surface publish` checks the scoped pre-state at [surface-publish.ts:497](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-publish.ts:497), then gates/uploads and writes the earlier channel at [surface-publish.ts:793](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-publish.ts:793).
   - `surface fork` checks destination occupancy/pre-state at [surface-fork.ts:704](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-fork.ts:704), then fetches, gates, uploads, and writes the stale destination at [surface-fork.ts:840](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-fork.ts:840).
   - `channels update`/`rename` checks that no surface exists at [channels.ts:523](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/channels.ts:523), then rewrites the entire description cell at line 574.

   Concrete failures:

   - Publish reads revision 1; another admin publishes revision 2 during upload; the first command overwrites revision 2 and its readback certifies its own overwrite.
   - Fork sees an empty destination; another writer publishes before landing; fork replaces it with revision 1 and orphans the intervening state.
   - `channels rename` sees an ordinary channel; another client publishes a surface; rename then drops that newly published definition without `--allow-unpublish`.

   The scope contract explicitly says the pre-state must still hold “at write time” in [surface-write-scope.ts:21](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/surface-write-scope.ts:21), but the tests mutate state only before command execution.

   **Verification:** source-traced/reasoned. The API sends a full edit value without a version/CAS token.

   **Negative control needed:** mutate the fake ship after the initial check—during bundle upload or immediately before `writeGroupChannel`—and require refusal with zero description writes. A last-second reread only narrows the race; enforcing “at write time” needs backend CAS/versioning or a server-side patch that preserves concurrent opaque fields.

3. **Medium — a corrected revision does not recover a halted sandbox.**

   An init error sets `halted`; the only clearing path is the manual Reload button. While halted, the component returns before rendering the keyed host, so a new healthy spec revision cannot mount a new session. See [SurfaceSandboxContainer.tsx:59](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/app/ui/components/SurfaceChannel/SurfaceSandboxContainer.tsx:59) and the early return at line 100.

   Input: revision 1 throws during initialization, then an admin publishes healthy revision 2. Result: every mounted viewer remains on revision 1’s error until manually reloading.

   **Verification:** source-traced/reasoned. Existing tests independently cover healthy revision replacement, halting, and manual reload, but not halt → healthy revision.

   **Negative control needed:** halt v1, rerender with v2, and require the halted state to clear and a fresh iframe to appear.

4. **Medium — the countdown doctrine again implies that publish owns `bundle.shellVersion`.**

   [countdown/NOTES.md:158](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/skills/surfaces/templates/countdown/NOTES.md:158) says the entire `bundle` block contains placeholders that publish overwrites. That block includes `shellVersion`. In fact, publish owns only asset reference/hash/size and preserves the author’s shell version; [surface-publish.ts:70](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-publish.ts:70) and [SKILL.md:188](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/skills/surfaces/SKILL.md:188) state the correct rule.

   A revising bot can consequently omit or reset a future shell-2 app’s field; publish defaults an absent field to 1, allowing old clients to run a bundle that actually requires shell 2.

   **Verification:** source-verified. Other template notes correctly enumerate only `assetRef`, `sha256`, and `size`.

   **Negative control needed:** a doctrine-constants test requiring every template’s bundle note to distinguish the three publisher-owned fields from `shellVersion`.

5. **Medium — preview doctrine describes two obsolete execution models.**

   - [RUBRIC.md:434](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/skills/surfaces/RUBRIC.md:434) says preview folds actions only, cannot express host events, and host-created archives/charts will be empty in all twelve cells. `--host-ops` now validates and folds real host entries in [surface-preview.ts:393](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/surface-preview.ts:393). A reviewer following the later rubric can excuse an empty chart instead of exercising it.
   - [rsvp/NOTES.md:51](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/skills/surfaces/templates/rsvp/NOTES.md:51) and [potluck/NOTES.md:79](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/skills/surfaces/templates/potluck/NOTES.md:79) say destructive actions must be declared first to avoid losing the last synthetic actor. Preview now runs a restore pass over every constructive action for every actor at [surface-preview.ts:565](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/surface-preview.ts:565). With the current action ordering, this does not produce “one actor under each answer/course”; later constructive actions overwrite earlier ones.

   **Verification:** source-verified; the restore-pass test is itself the negative control proving the notes are stale.

6. **Medium — the claims index is materially stale and its counts cannot describe this HEAD.**

   The index identifies itself as a dirty working tree at `2c62221d7b`, not the reviewed commit, at [surface-channels-claims-index.md:3](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/surface-channels-claims-index.md:3).

   It overstates §A by at least:

   - A2b: the CI job is now committed.
   - A3: CI now executes shell `check:all` at [.github/workflows/ci.yml:149](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/.github/workflows/ci.yml:149).
   - A7: the plan now says 1024 B.
   - A11: how-it-works now says the policy ships enforcing.
   - A19: the wrong-target write scope and controls now exist, although Finding 2 identifies a remaining race.
   - A21: fork now binds `specSha256` and tests spec-only source movement, while the plan remains stale.
   - A23: `surface-create.test.ts` now has burned-name and create-observation negative controls.
   - B8: `surface-transitions.test.ts` now contains the S2 case.

   It also misses the now-false plan/RUBRIC “host events cannot be previewed” claim and cannot describe the new guards introduced after its dated snapshot.

   **Verification:** current source checked directly. Current remote PR wording and whether CI actually ran are external, so A8/A10 were judged only from the session report.

   **Negative control needed:** regenerate or validate the index against an exact clean commit in CI, including existence checks for every cited claim/control anchor.

7. **Low — fork’s “fresh ID / empty history” invariant is asserted but not enforced.**

   Fork accepts any `--surface-id` except the source’s own ID at [surface-fork.ts:697](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/commands/surface-fork.ts:697), and destination emptiness checks only the current description—not retained posts.

   Input: explicitly unpublish destination surface `old-id`, leaving its event posts; fork a different source into that channel with `--surface-id old-id`, revision 1. Old revision-1 events matching the reused ID immediately fold into the supposedly pristine copy. A preserve-state boundary-0 snapshot does not suppress later old events.

   **Verification:** source-traced/reasoned. Normal staged random IDs make this unlikely; manual/reused IDs make it deterministic.

   **Negative control needed:** absent destination definition plus old posts for the requested ID must refuse before upload/write.

8. **Low — the reducer’s public “posts, any order” contract still diverges when tied posts omit their optional IDs.**

   `SurfacePostView.id` remains optional, and `comparePostIds` returns equality whenever either ID is absent. JavaScript’s stable sort then preserves caller order.

   **Verification:** reproduced directly: two tied host writes without IDs reduce to `{"x":2}` in one input order and `{"x":1}` in the reverse order. The comparator also violates antisymmetry for distinct numeric strings that normalize to the same digits, such as `1.000` and `1000`.

   Production DB adaptation supplies canonical IDs, limiting shipped exposure, but the exported reducer contract is false. See [reducer.ts:115](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/client/surface/reducer.ts:115).

   **Negative control needed:** reverse two conflicting tied no-ID posts and require equal output, or make IDs mandatory for sequenced inputs.

9. **Low — `inert-action` suppression is prefix-based and masks unrelated actions.**

   [surface-lint.ts:2282](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/surface-lint.ts:2282) uses `startsWith("actions.${id}")`.

   **Verification:** reproduced. With dead action `vote` and malformed action `vote-no`, lint reported only `pointer-hygiene` on `actions.vote-no...`; renaming the latter to `no-vote` made the missing `inert-action` finding for `vote` reappear. The gate remains red, so impact is an extra repair cycle rather than a dead action shipping green.

   **Negative control needed:** the exact prefix-collision fixture above. Compare path segments—`actions.vote`, `actions.vote.`, or `actions.vote[`—rather than a raw prefix.

10. **Low — `memberInteraction` can contradict a nonempty action map and still pass the gate.**

    The schema permits the marker independently of `actions` at [schemas.ts:165](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/api/src/client/surface/schemas.ts:165); lint returns immediately when actions exist at [surface-lint.ts:1301](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/scripts/surface-lint.ts:1301); the rubric applies check 8 whenever the marker exists.

    **Verification:** reproduced with the compliant interactive fixture plus `memberInteraction`: lint passed clean and the generated check list included check 8.

    **Negative control needed:** an actionful spec carrying `memberInteraction` should fail schema/lint, or the marker must be ignored outside an empty action map.

11. **Low — SKILL’s date rule is false against its own canonical countdown.**

    [SKILL.md:240](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/packages/tlon-skill/skills/surfaces/SKILL.md:240) says dates exist only where a host event wrote them. The countdown stores `targetMs`, labels, and run-up dates in `initialState`, and PARADIGM correctly permits “a value written once at creation.”

    **Verification:** source-verified. This can teach a bot to invent unnecessary scheduled writes, but does not directly corrupt existing state.

I found **no additional escape-hatch-before-rule ordering defect**. In particular, PARADIGM now explains why an empty action map is dangerous before introducing `memberInteraction`, and the countdown explains the display/write rule before showing its marker.

## Claims-index verification backlog

Restricting this ranking to in-scope state/capability correctness—the containment rows requiring excluded material are called out below—the top five are:

| Rank | Claim | Work order |
|---|---|---|
| 1 | Lower group: non-publish writers inherit `preserveState` only as an obligation | Exercise another writer against a live preserving board and require either carried state/snapshot or refusal. This is known-open, but highest damage: wholesale reset. |
| 2 | A17: newer-version publish refusal | Store a valid-looking future-version definition, run publish, and require `spec-version-too-new`, zero upload, zero write. Mutate/remove the branch to demonstrate failure. |
| 3 | A12: wire edit mapping | Feed a real wire/persisted `revision: "1"` post through `postsApi` and the reducer; require it to retract. Mutating the mapping to `false` must fail. |
| 4 | A22: backend kind and size backstops | Add `test-agent` or Aqua negatives for wrong kind head and `256 KiB + 1`; assert nack/no state mutation. The guards exist at [channels-server.hoon:1084](/Users/patrick/workspace/homestead-tlon-skill-testing-strategy-phase-3/desk/app/channels-server.hoon:1084), but current Hoon tests do not exercise them. |
| 5 | A14: exact sandbox API surface | Assert the exact `Object.keys(surface)` set, then add a canary member and demonstrate failure. |

Disposition of every remaining §A item:

| Row | Disposition |
|---|---|
| A1 | Known-open native/device question; cannot assess without the separately scoped device/containment work. |
| A2 | An absence/watchpoint claim; low state-integrity value, acceptable as explicit provisioning tracking. |
| A2b | Stale row: the job is committed; remote execution was not verifiable from the repo. |
| A3 | Stale row: shell boundary checks are now wired to CI. |
| A4 | Requires the expressly excluded lint/navigation material; no verdict. |
| A5 | Historical lint ratio, not a runtime invariant; acceptable uncontrolled. |
| A6 | Known doc-drift risk; not runtime state, but Findings 4–6 show it is not harmless. |
| A7 | Stale claim; the plan now matches the 1024-byte cap. |
| A8 | Current PR body is not in the repo; the report says corrected, but I could not source-verify it. |
| A9 | Fixed repair order affects bot efficiency, not whether a red gate can become green; low damage. |
| A10 | CLI fork exists; UI/external PR wording was not source-verifiable. |
| A11 | Stale row; current how-it-works text is corrected. |
| A13 | Final hash-to-DOM composition depends on the excluded browser composition test; I cannot judge it here. |
| A15 | Defined-error availability rather than stored-state integrity; below the top five, with Finding 3 the newly found gap. |
| A16 | Transport failure strands interactions but does not mis-fold them; full composition requires excluded material. |
| A18 | Measurement-process integrity, not shipped state; acceptable uncontrolled. |
| A19 | Stale as written because the write fence now exists; Finding 2 is the remaining untested interleaving. |
| A20 | Requires excluded containment/delivery material; no verdict. |
| A21 | Code and tests now bind the spec hash; the plan/index text is stale. |
| A23 | No longer uncontrolled: current create tests cover burned names and failed observations. |
| A24 | Documentation/performance number only; acceptable uncontrolled if removed from safety reasoning. |
| A25 | Requires excluded containment probes; no verdict. |
| A26 | Notification privacy/lifecycle limitation, not surface-state correctness; acceptable as a named residual. |
| A27 | Documentation/process contradiction; should be reconciled but cannot itself corrupt state. |
| Hermes parity | Potentially serious when Hermes becomes a writer; currently covered by the broader preserve-state writer obligation. |
| No product entrypoint | Product-status statement only; harmless uncontrolled. |
| Review status | Process statement; harmless to runtime. |
| “101 pages” drain | Historical measurement; harmless if not treated as a permanent guarantee. |
| D130 format measurement | Historical authoring metric; harmless uncontrolled. |
| npm-registry gap | External provisioning status, not state correctness. |
| App Store precedent | Contextual precedent, not an invariant. |
| Groups-admin enforcement | Backend authorization property; important, but outside this delta and not a convergence mechanism. |
| Nine seeded live walkthrough | Demo evidence, not an automated invariant. |

I did not rank A1/A4/A13/A20/A25 against the in-scope rows because doing that responsibly would require the material the brief expressly prohibited.

## Validation and coverage

- Direct reproductions: reducer no-ID divergence; `inert-action` prefix masking; contradictory `memberInteraction`; SQLite tie-order dependence.
- The five `SurfaceChannel` app suites ran **37/37 passing**; Vitest still exited nonzero because the read-only environment prevented its result-cache write.
- The focused Bun run reported **505 passing, 4 browser skips, 22 failures**. Every failure I inspected was `EPERM` while creating preview/temp directories, not an assertion failure.
- API/shared/surface-shell Vitest attempts were blocked before test execution by read-only timestamp/cache writes.
- `git diff --check` passed. I made no changes.

Coverage of the 87-file primary delta:

- Opened all 51 implementation/support files, plus the explicitly named unchanged `packages/shared/src/db/schema.ts`.
- Read relevant blocks in 19 of 36 test files: reducer/schema, hydration, all three host/session suites, shell harness/protocol, channels, fork, publish, records, lint, preview, transitions/actor differential, rubric, doc constants, and write-scope.
- The remaining 17 tests were searched and diff-skimmed for claimed controls, not read linearly end-to-end.
- Doctrine: line-read all four core documents and all seven changed `NOTES.md` files. The nine app bundles and fourteen JSON files were inspected through their diffs, targeted searches, and template/gate controls rather than line-read as prose.
- Supporting dependencies read outside the filtered delta: database pagination, the wire post mapping, group-channel update API, backend channel documentation, `%channels-server` guard source/tests, CI wiring, D100–D186, and the permitted reports/index.
- No runtime finding rests solely on a decision record or report. A8/A10’s current PR wording and historical CI execution were the exceptions that could not be verified from source.
- I did not open any prohibited path, the two excluded lint rule bodies, plan §5, or `packages/openclaw/dev`. I did not run a live Urbit ship or a full database integration.
