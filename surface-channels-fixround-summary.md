# Surface Channels — fix round, per-finding summary

Input to the split re-verification passes. Ten commits,
`12fc12ed80..4edbe7ab62`, 43 files, +6,433/−306.

Every entry names its **negative control** — the demonstration that the
control can fail. A control without one was not accepted this round.

**Read this first if you are re-verifying:** the round's organising rule was
that every High has an incident fix and a class fix, and the class fix is
the deliverable. Where a class fix is claimed below, the thing to attack is
whether it actually closes the class or only the instance that was found.
Three of these were rulings extended beyond what the round's own prompt
specified, and those are the likeliest places to find an error.

---

## 1. Raw-versus-validated comparison — `8f136d1a0c`

**Files:** `packages/api/src/client/surface/schemas.ts`,
`packages/tlon-skill/scripts/commands/surface-publish.ts`,
`scripts/surface-lint.ts`, tests in both packages.

`z.object` strips undeclared keys, so a spec written with a gate-only marker
and read back through the schema differ — every comparison of the two sees a
difference that is not there. Three live appearances (D67, D72,
`decideRevision`'s false bump) plus one predicted in `surface fork`, which
does not exist yet. `duplicatesTolerated` is now a declared optional
boolean, **and** `decideRevision` keys the previous side off the verbatim
cell rather than the validated spec. The schema field alone was not the
class fix — the round's prompt asserted it was, and that was wrong: the next
undeclared key reproduces the same false bump, same blast radius (revision
bumps, prior events stop folding, live state resets). Also deleted the
post-write confirmation's unreachable `catch` fallback to `read.spec`.

**Negative control:** reverting the comparison to the validated spec makes
the new test fail with revision 5 where 4 is correct. Deleting the schema
line fails the api-side test _and_ re-fails the tlon-skill regression, which
pins causality to the field rather than coincidence.

**Attack this first:** the 17-site comparison audit. One site
(`surface-publish.ts` `catch` fallback) was latent and unreachable; if the
audit missed a site, this class is still open.

---

## 2. `--preserve-state` stranding — `e573cd618e`

**Files:** `packages/api/.../schemas.ts`,
`packages/tlon-skill/scripts/commands/{surface-publish,surface-records,surface-common}.ts`,
`skills/surfaces/SKILL.md`, `surface-channels-plan.md` §7 caps.

A legal state between 64 and 128 KiB permanently stranded a channel: the
reducer allowed 128 KiB, snapshots 64, and publish validated the migration
snapshot _after_ moving the description cell. Four fixes — the snapshot cap
is now tied to the reducer cap rather than set independently; publish
validates every record it intends to write before writing anything; standalone
`surface snapshot` at a pending revision is permitted because it is the only
repair; and errors carry an author-versus-environment class, stamped last so
a call site cannot relabel its own failure.

The mirror's validation moved too, not just the snapshot's — the command
stops at the first failure and the snapshot posts second, so a mirror
failing validation post-write strands identically. That generalisation is
the class fix.

`SKILL.md` was corrected in the same commit because the doctrine told the
bot that any command error is verified failure and that `invalid-ops` means
the author's files are wrong. A bot following it would have blamed the user
for a system refusal and might have retried destructively.

**Negative control:** the stranding sequence and the recovery each
reproduced as failing tests pre-fix (2 and 7 failures), passing after. Six
further mutations, each caught by exactly one test.

**Known residual:** an exact retry over a stranded channel still returns
`ok/no-op` — success over a dead channel. Publish can no longer create that
state and snapshot now repairs it, so it is transport-caused only.

**Ceiling worth knowing:** at 128 KiB a snapshot post is ~51% of
`%channels-server`'s 256,000-byte `size-limit` (a hard `?>` at
`channels-server.hoon:1087`). The cap cannot rise much further without
pricing that backstop.

---

## 3. `surface snapshot --up-to N` — `75fb52f1d3`

**Files:** `packages/tlon-skill/scripts/commands/surface-records.ts` + tests.

The command reduced the whole history and wrote that full reduction as the
state for a _lower_ boundary, so events between N and the newest post were
both inside the snapshot and still replayable — two appends and `--up-to 1`
produced `["a","b","b"]`. Now folds to the boundary. Rejection was the
alternative and was rejected: a boundary below the newest post is what
leaves the tail replayable and therefore retractable, so a flag accepting
only the watermark deletes its own reason to exist.

**Negative control:** three tests fail pre-fix, including the duplication
from a throwaway probe. The freeze-out direction is unreachable after the
fix but reachable as an off-by-one within it, so it is mutation-controlled:
`<=` → `<` loses `'a'` permanently rather than duplicating it.

**Known residual, same class, not fixed:** `foldForMigration`'s `!current`
branch (`surface-publish.ts`) pairs a new definition's `initialState`, which
covers nothing, with a boundary at the newest post. The analogous case on
the repair path is an explicit refusal; here it is a silent freeze-out. One
of the two is wrong.

---

## 4. Cap-refusal semantics — `267ebaeb01`, extended by `0928aeaff2`

**Files:** `packages/api/src/client/surface/{reducer,jsonPointer}.ts`,
`surface-channels-plan.md` §7, `skills/surfaces/PARADIGM.md`.

`PARADIGM.md` prescribed the rollover as `set /history/<date>` then
`del /today` in one event and called it fully idempotent, while separately
saying a failed op is skipped and the rest apply. Near the cap those combine
into data loss: the archiving `set` is refused, the `del` applies, and the
state keeps neither.

Ratified amendment: an op refused **because state could not take the write**
aborts the remaining ops in its entry; only a **malformed** op skips.
`applyOp` returns a tagged refusal kind rather than an error string, and one
set decides at one place in the fold loop.

**Extended beyond the round's specification, on an explicit ruling:**
implementing it revealed three refusal kinds, not two. A `structure`
refusal — writing through a scalar, appending onto a non-array — is
state-dependent exactly as a cap is and reproduces the identical loss. It
now aborts. The set was renamed `RESOURCE_REFUSALS` → `STATE_REFUSALS`,
because "resource" stopped describing its members, and §7 states the
criterion rather than the list so the next kind has a home without another
ruling.

**Negative control:** the data-loss sequence fails pre-change with
`state.today` undefined; the prefix property shrinks to the same bare
`del /today` counterexample in both the cap and structural cases. Twelve
mutations across the two commits, each killing its own tests — including
that raising `stateFull` for every member fails the depth and structure
controls.

**Determinism:** state is a pure function of the sorted log; the depth cap
is a function of the op alone; the size cap goes through `JSON.stringify`,
whose key order is insertion order fixed by the op sequence. Two convergence
properties are the evidence.

**Reported, not ruled:** `del /a/b` where `/a` holds a scalar returns
success-unchanged; where `/a` holds an array it returns a `structure`
refusal. Both mean "nothing at that path", and one now aborts the entry
while the other does not. Divergence is in the safe direction. §7's own
"`del` on a missing path is a no-op" suggests the array branch is the odd
one out.

**Reporting gap:** `surface state` surfaces `stateFull` but never
`abortedEventCount`, so a structurally aborted entry reaches a host as
nothing at all.

---

## 5. Observation accepting pre-existing state — `70e59bd8c5`

**Files:** `packages/tlon-skill/scripts/commands/{surface-writer,surface-create}.ts`,
`scripts/surface-test-doubles.ts`, tests.

Third and fourth appearances of the observation class after D50 and D68.
`postSurfaceRecord` matched on author + sender-supplied `sentAt` + blob, so
a matching prior post plus a silent no-op returned success and the **old**
post id. It now reads the channel head before poking and requires a
host-assigned sequence above that baseline. `surface create` drew eight
candidate names and on the eighth collision assigned a ninth **without
checking it**; that path is deleted rather than repaired, and exhaustion is
a clean refusal that pokes nothing.

The class fix is separate from the loop: presence in both agents is also
what a silent no-op onto a name taken between check and poke looks like, so
observation now requires `%groups` to list the channel under the title
_this command poked with_.

Two test-double faithfulness fixes were prerequisites — sequence numbers now
stamp above every sequence held rather than from list length, and
`applyCreate` onto an existing name is a silent no-op that still resolves,
which is D50 itself and the one part of D50 the double could not previously
express.

**Negative control:** both pre-fix runs wrongly report success, both
post-fix runs report failure. Six mutations, including that restoring the
ninth-candidate loop is caught by the **title check** rather than the loop
test — which is what makes the title check the class fix.

**Known residual:** `retractSurfacePost` observes `isEdited`, which any
earlier edit already satisfies. The fold outcome is right either way; the
over-claim is the rewritten fallback text.

---

## 6. Sync-writer column drift — `bacc96fe4c`

**Files:** `packages/shared/src/db/queries.ts`, three test files.

`insertGroups` hand-listed its conflict columns while `insertChannelsInternal`
used `conflictUpdateSetAll`. D56 patched the hand-list; the class stayed
armed and already had two more live instances (`iconImageColor`,
`coverImageColor`, both populated by `toClientChannel` and absent from the
list, so an admin's colour change was pinned forever on every boot).

Now `conflictUpdateSetAll` with an exclusion list derived by auditing all 29
columns — **not** cloned from the other writer, which would have reproduced
the defect sign-flipped inside a correct-looking shape.

**A mechanism the "is `%groups` authoritative?" framing misses entirely:**
Drizzle's `buildInsertQuery` emits every column and substitutes `null` for
absent keys, so `excluded.<col>` is null for anything the payload does not
carry — **naming such a column erases it rather than refreshing it**.
`toClientChannel` carries 13 of 29, and the old list named two it does not,
so `insertGroups` had been nulling `addedToGroupAt` and `isPendingChannel`
on every boot. An audit driven only by authority would have preserved that.

**Negative control:** colour convergence and payload-not-carried
preservation both fail pre-fix. The pin test fails on a synthetic
unclassified column, and separately on a misspelled exclusion entry.

**The pin test as originally specified could not fail** — coverage computed
as `schema − exclusions` means a new column lands in "updated" and the union
is still the whole table. The guard is a pinned literal list; the union
assertion is kept for the rename direction only.

**Left diverged deliberately:** `insertChannelsInternal`'s callers carry a
different subset, so a shared list would be wrong for one of them. Its
opposite failure mode (over-update) is unpinned.

---

## 7. CI gating — `048a978952`

**Files:** `.github/workflows/{ci,tlon-skill-publish}.yml`,
`scripts/check-ci-path-filters.mjs` (new).

The headless preview leg was wired into `bot-checks`, gated `app == 'false'`
— so it never ran on any branch this feature ships on, and would have failed
if it had, because `bot-checks` lacks `build:surface-shell` and
`surface-preview` imports the gitignored `dist/`. **Correction to how that
was first described:** it is `pnpm test` that dies at module load, not the
typecheck; `tsc` cannot follow an `exports` subpath at all, which is what the
`@ts-expect-error` lines are for. "The typecheck catches it" would have been
false coverage surviving the fix. Two jobs in `tlon-skill-publish.yml` have
the same gap, latent until the first release cut after merge.

The leg now runs in both jobs, which are mutually exclusive per PR.
`packages/surface-shell` is classified in both path filters — it was in
neither.

**Class fix:** `check-ci-path-filters.mjs` asserts every workspace package is
selected by some filter, using dorny's real semantics including
`predicate-quantifier`, reading the actual workflow and workspace globs
rather than a hardcoded list. It runs ungated in `ci-config-check` and blocks
`ci-ok` — a package no filter selects skips every filter-gated job by
definition, so a gated guard would be blind to its own defect.

**Negative control:** dropping tlon-skill from `bots`, adding a
surface-shell exclusion without the `bots` entry, and renaming a package out
from under a filter each produce a named error and exit 1.

---

## 8. The gate: activation, oracle, claims — `e18c6472e6`

**Files:** `packages/tlon-skill/scripts/surface-lint.ts`,
`surface-lint-fixtures.ts`, tests, `PARADIGM.md`, `PRIMITIVES.md`,
`surface-channels-plan.md` §5/§9/risk table.

**The behavioral phase never ran a handler.** `foldAndRender` called the
fixture and pushed state and nothing else, while `ShellFixtureRun` had
exposed a `click` method no caller used — so a chart built in a click
handler, or copy appearing only after interaction, was invisible to four
rules at once. Controls are now found by wrapping `addEventListener` rather
than by selector, because `div onClick` binds as readily as `button`. Three
shortfalls name themselves in skips rather than passing silently.

**The chart oracle** read the recorded constructor config, so a bundle that
constructed responsively then reassigned `chart.options` passed. It reads the
live instance now. The documented assertion was also factually wrong — real
Chart.js sets `width`/`height` on the canvas itself in `retinaScale`, so
asserting their absence cannot be what a real render measures.

**Rule 5 stops calling itself the primary boundary** — in its docstring,
plan §5, plan §9 and the risk table (the last two were left standing by the
step's own scope and fixed separately). Measured against the audit's probe
batch: **1 of 18 navigation spellings caught before this round, 5 of 18
after.** That number is now in the plan instead of the claim.

**Negative control:** ten mutations each killing exactly their own tests,
including that reverting the oracle while leaving activation on fails
exactly one test — which shows both halves are independently necessary.

**Process failure worth recording:** the navigation coverage-gap audit was
never written into `DECISIONS.md`. It lived only in a session transcript, so
this step had to reconstruct it from raw probe output in `sol-review-r3.log`,
where the audit had been cut off by a content filter before writing anything
up. Now D92/D93.

---

## 9. Host CSP enforcement — `4edbe7ab62`

**Files:** `apps/tlon-web/hostCsp.ts`, `src/logic/hostCspViolations.ts` (new),
`src/main.tsx`, `sandbox-posture/navigation.spec.ts`,
`e2e/host-csp{,-collector}.{spec.}ts` (new), `e2e/test-fixtures.ts`.

`ENFORCE_HOST_CSP` is now `true`. The policy is one directive —
`frame-src 'self' https://tlon.network` — with no `default-src`, so images,
scripts, fetch and media are unrestricted.

**Gate A** — the posture suite under our exact policy: 159/159 on chromium,
firefox and webkit, five vectors `BLOCKED-PREFLIGHT`, `attackerServerHits=0`,
srcdoc frame still loading. **Gate A needed fixing before it meant
anything:** the suite builds its own host pages and never reads
`ENFORCE_HOST_CSP`, so the flag could not change a cell and the gate as
written was satisfiable by a run proving nothing new. A shipped-policy
configuration now imports `HOST_CSP_POLICY` and delivers it through the same
`<meta>` the build injects, against a live attacker server.

**Gate B** — the full e2e suite under Report-Only with a collector on every
page: 101 pages drained, 0 violations, 0 dropped, `FRAME_SRC_SOURCES` not
widened. The zero is defensible because `host-csp.spec.ts` ran inside the
same suite and made the same listener fire on a real violation, so the
instrument was alive in the environment that produced the zeroes.

A blocks; B proves completeness. They are different claims and both were
required.

**The listener** is the only violation signal that survives enforcement —
`report-uri` does not exist in a `<meta>` policy, so a missing origin becomes
a silently broken feature. Sanitisation is by construction: the URL is parsed
and only protocol and host are ever read, so path, query and fragment are
never reached; the raw value survives as a hash that doubles as the dedupe
key. The bound is five emitted per page load checked **before** dedupe,
because deduping first lets a loop over distinct URLs grow the dedupe set
without limit.

**Negative control:** 20 identical hostile frames → `emitted: 1,
dropped: 19`, marker absent from telemetry. 20 distinct hosts → `emitted: 5,
dropped: 15`. An allowlisted origin → `emitted: 0`.

**The flip would have broken its own control:** `transformIndexHtml` runs on
the dev server too, so enabling it put dev under both the enforcing meta and
the Report-Only header — two policies refusing the same frame, two events per
violation, and the "exactly one event" assertion would have failed with the
obvious repair being to loosen it. The redundant dev header is dropped
instead.

**Scope limit:** web only. On iOS/Android the sandbox is a React Native
`WebView` with no host page.

**Coverage stated:** `ManageAccountScreen` — the one allowlist entry a real
feature depends on — has no e2e coverage, so it is covered by the
allowlisted-origin case in `host-csp.spec.ts`. The ~bus, ~mug and S3
media-viewer specs were skipped in this environment.

---

## Verification at close

`packages/api` 1065/1065 · `packages/shared` 624/624 ·
`packages/tlon-skill` 899 pass / 1 skip / 0 fail **on CI's pinned bun
1.3.14** + hermetic 362 · `packages/surface-shell` 68 · `apps/tlon-web` CSP
units 16/16 · typecheck clean · `oxfmt --check` clean · `build:smoke` exit 0.

**A correction that stands for the whole round:** the four `media-guard`
TLS failures reported as "pre-existing" throughout Session 5 are a **local
bun 1.3.4 artifact**. On CI's pinned 1.3.14 that file is 113 pass / 0 fail
and the suite has always been fully green. Any re-verification should use the
pinned bun; a stock local install will manufacture four failures that do not
exist in CI.

---

## For the re-verification passes

Plan them **split from the start**. Sustained analysis of sandbox-escape
material is refused by at least one external provider's classifier — twice,
the second time after 205k tokens of real work — and the refusal tracks the
subject matter, not the phrasing. The correctness half and the
containment half need different reviewers, and reports on the containment
half should stay at the level of engineering conclusions with specifics left
in the repository.

**Highest-value targets, in order:**

1. The three class fixes extended beyond the round's own specification
   (§1 `decideRevision`, §4 structural refusals, §6 the reasoned exclusion
   list). Each was a judgment call made against the prompt's stated scope.
2. The residuals listed above, all deliberately unfixed: `foldForMigration`'s
   `!current` branch, the `ok/no-op` over a stranded channel,
   `retractSurfacePost`'s `isEdited` observation, the `del`-through-scalar
   asymmetry, and `abortedEventCount` never reaching a host.
3. Whether the new guards can fail. Two were specified in ways that could not
   (§6's pin test, §9's Gate A) and were corrected during implementation —
   assume there is a third.
