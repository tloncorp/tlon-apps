# Surface Channels — Session 5 consolidated report

**Status: build complete, both review passes landed, findings verified but
not yet dispositioned or fixed.**

Session 5 built the authoring infrastructure — the CLI command group, the
publish gate, the preview step, the skill documents, and the first two
templates. All nine steps are done and pushed to `patrick/mini-app-mvp`.
Two review passes then ran over the result. This report consolidates the
build and both reviews.

An earlier build-only report is committed at
`surface-channels-session5-report.md` (522 lines) and remains accurate
about the construction work, step by step. This document supersedes the
preliminary review report that briefly sat alongside it.

---

## 1. What shipped

| Step | Deliverable                                                                                    | State                  |
| ---- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| 2    | D56 diagnosed and fixed — spec change-detection keys on cell **content**, not `specRevision`   | done                   |
| 3    | Shell: sigil avatar + container-owning chart primitive (additive; `SHELL_VERSION` unchanged)   | done                   |
| 4    | `surface *` commands: create / templates / lint / publish / event / state / snapshot / preview | done                   |
| 5    | The publish gate — 14 rules, machine-readable violations                                       | done; see §3           |
| 6    | `surface preview` — real assembler, real shell, real CSP, headless chromium, 12 cells          | done; CI wiring see §5 |
| 7    | Skill documents: `SKILL.md`, `PARADIGM.md`, `PRIMITIVES.md`, `RUBRIC.md`                       | done                   |
| 8    | Poll + workout-tracker templates promoted; live loop proven on fakeships                       | done                   |
| 9    | Quality-control plan amendments applied on-branch                                              | done                   |

Decisions recorded: **D60–D74**.

Commits, newest first: `0c79867fa1` (ship the skill; make the shipped CLI
find its templates) · `e2b6eca886` (record D68–D72, close plan amendments,
build report) · `2366b0fec0` (run the preview capture in CI) ·
`af020ac8d6` (promote templates, fix `surface create`) · `5002b721ac`
(`SKILL.md`; fix publish rejecting gate-only spec markers).

The live loop was proven end to end on the fakeships: create → lint →
preview → publish → cross-ship interaction → one revise cycle. A second
ship voted from a real browser, the folded state converged, a repeated tap
changed nothing, and a republish at revision 2 was picked up by the
running client with no reload — which exercised the D56 fix in anger. The
workout tracker ran the same way, with the client deriving its
progression and drawing a real chart.

---

## 2. Correctness review: ten findings, four High

The correctness pass ran 172 focused authoring tests including real
Chromium, 109 API reducer/schema tests, 36 shell tests, and the Hermes
suite, and made no repository changes. Its summary: **"the authoring layer
is not yet safe for preserving live state."**

Findings 1–4 are verified data-loss or state-stranding paths. None is a
security issue; all are ordinary correctness defects in the write path.

**1 — High. A legal state between 64 and 128 KiB permanently strands the
channel on `--preserve-state`.** The reducer permits 128 KiB; snapshots
permit 64 KiB (`schemas.ts:35`). Publish writes and observes the new
description, posts the mirror, and validates the snapshot _last_. With a
legal state above 64 KiB, a title-only preserving revision moved the
description to revision 2, landed the mirror, then had the snapshot
rejected — and the reducer now returns `migration-pending` permanently.
Retrying exits through the no-op path; standalone `surface snapshot`
refuses a pending revision; a further preserving revision cannot migrate
either. Recovery means republishing without preservation, discarding the
state. The design's "pending window is one command wide" holds **only on
the success path**. The doctrine compounds it: `SKILL.md` tells the bot
that any command error is verified failure and that `invalid-ops` is an
author-file error — but here the definition landed and the author's ops
were valid.

**2 — High. An identical app carrying `duplicatesTolerated` is treated as
changed, resetting all live state.** `decideRevision` compares a
schema-validated previous spec against a raw candidate
(`surface-publish.ts:217` vs `:311`). The schema strips the marker, so
republishing the same spec reports `changed: true`, bumps the revision,
and — because preservation defaults off — stops revision-1 events folding
and resets to `initialState`. This is the **third** instance of the same
root cause, and the one the review brief predicted. The post-write
confirmation was corrected earlier this session; revision _selection_ was
not.

**3 — High. `surface snapshot --up-to N` writes the full fold under a
smaller boundary.** With two appends, `--up-to 1` writes both entries
while claiming coverage through sequence 1; the reducer then correctly
replays sequence 2, duplicating it. Events at or below the claimed
boundary are frozen out permanently.

**4 — High. The rollover pattern `PARADIGM.md` prescribes can erase
unarchived data.** The doctrine tells authors to `set /history/<date>`
then `del /today` in a single event and calls it fully idempotent; it
separately says a failed op is skipped while the remaining ops apply. Near
the state cap the archiving `set` is refused and the shrinking `del` still
applies, leaving neither the archive nor `/today`. The doctrine needs to
forbid destructive ops whose safety depends on a preceding op succeeding.

**5 — Medium. Hydration's completeness predicate can certify a partial
history.** `complete: true` is returned solely when `older === null`;
`totalPosts`, duplicate IDs and page drift are ignored
(`surface-writer.ts:177`). A page holding only sequence 10 with
`totalPosts: 10` was reported complete — a snapshot taken from it would
claim boundary 10 while omitting 1–9. The notes migration reader in this
repo already implements the checks this needs.

**6 — Medium. The chart rule measures a stub, not Chart.js.** The gate
substitutes a recording stand-in and the rule reads the saved
_constructor config_ rather than the live instance, so a bundle that
constructs responsively and then reassigns its options passes. Separately,
rendering the real workout template through the real shell in Chromium
showed that real Chart.js **does** add `width`/`height` to the canvas — so
`PARADIGM.md:344`'s claim about what the smoke render asserts is not what
the test measures. This is the same class of defect the behavioral check
was introduced to eliminate.

**7 — Medium. Post and create observations can accept pre-existing state
as proof of a new write.** `postSurfaceRecord` matches on author,
sender-supplied `sentAt` and blob only; with a matching prior post and a
silent no-op it returns success and the _old_ post ID. `surface create`
checks eight candidate names and then assigns a ninth **without checking
it**, so a no-op create reported success and the requested title while the
stored channel kept its old one.

**8 — Medium. Byte caps are measured after unknown fields are stripped.**
40 KiB of unknown top-level data passed both schema validation and the
publish lint; an oversized event passed the nominal 8 KiB cap. Existing
boundary tests pad _declared_ fields, so they miss this shape.

**9 — Low. Unevaluated rules are not always reported as skipped.** Module
syntax and schema-invalid specs skip correctly with stated reasons; a
plain parse failure returns an empty skipped list although two behavioral
rules never ran. `ok` is still false, so no clean false pass was produced —
but the skipped-versus-passed contract is not honoured on that path.

**10 — Low. The Chromium CI leg skips on this branch.** See §5.

### What the review found sound

The fold-idempotency check genuinely calls the production reducer once and
twice, exercises `$actor` resolution, fails unmarked `append` actions, and
reads `duplicatesTolerated` off the raw spec correctly. RFC 6901 parsing,
`~0` handling, `$actor` substitution, own-property reads, forbidden
prototype keys, and the pointer, depth and growth caps all held — **no
prototype-pollution path was found**. Publish's post-write definition
comparison correctly uses the raw cell. The shell's own chart primitive
forces responsive options correctly; the defect is the lint's oracle, not
the primitive. Release staging copies the complete skill and templates,
and the registration changes passed on both bot runtimes.

---

## 3. Validation review: the gate's claim exceeds what it does

The second pass audited the completeness of the publish gate's rule 5,
which rejects bundles that could make the frame load an outside address.
The design leans on this: plan §5 and the rule's own docstring
(`surface-lint.ts:577`) call it "the PRIMARY boundary" for that class,
because the sandbox and the shipped CSP do not cover it and the host-page
`frame-src` allowlist that _would_ cover it is written and verified but
ships disabled.

**The audit's conclusion is that rule 5 is not a boundary and cannot
become one.** Two structural reasons, both verified:

- **The rule enumerates.** It is a small set of source patterns over a
  platform capability set that is open and still growing, so keeping it
  current is a permanent maintenance liability. The audit found at least
  one current platform API the rule does not model at all, and confirmed
  the project's own sandbox-posture test matrix does not cover it either.
- **The gate never exercises event handlers.** The smoke render calls the
  fixture and pushes state, and nothing else. The fixture already exposes
  a click method; no caller uses it. So anything reachable only from a
  button handler has never been inspected by the behavioral phase, on any
  DOM implementation. This is not specific to rule 5 — it also narrows
  `chart-sizing`, `jargon` and `smoke-render`.

A third problem is arguably worse in practice. Rule 5's **most likely**
firing in ordinary use is a false positive: a data field named `location`
(a potluck, meetup or event app) and a function named `open` (modal,
accordion, drawer) both trip it. A rule whose commonest firing is wrong
trains a self-repair loop to work around it — and the routes it would find
are exactly the ones the rule does not model.

`document.ts:83-88` already states the honest position in the source:
containment comes from the host page's `frame-src` allowlist and,
structurally, from the M4 Worker-realm migration, and nothing in that file
substitutes for either. That sentence applies to rule 5 as well.

**The false claim is the finding.** Rule 5 is a useful lint that catches
naive spellings. Documenting it as the primary boundary is what stops
people looking for a real one.

### Recommendation, not yet decided

1. **Enable the `frame-src` allowlist.** It is the only measured
   pre-flight control in the codebase, verified on chromium, firefox and
   webkit, and it is a config change rather than a research project. This
   is a shipping-posture decision and has not been taken unilaterally.
2. **Rewrite the claims** in plan §5 and the rule's docstring to describe
   what the lint is.
3. **Cheap improvements worth making regardless:** model the missing
   platform API and the two markup routes the project had already
   identified; narrow the `location` pattern to the member form (the bare
   identifier is already neutralised at runtime, so this costs nothing and
   removes the false positive); stop the `open` pattern firing on
   declarations; and **wire the existing click method into the behavioral
   phase**, which widens three rules at once and is the highest-leverage
   edit in the file.

Specifics — the exact APIs, patterns and reproductions — are recorded in
the repository alongside the code rather than here.

---

## 4. Defects found and fixed during the session

Each was found by writing a test expecting it to pass, or by verifying a
claim rather than accepting it.

- **`surface create` could never succeed** (D68). `authenticate` opened no
  subscriptions, but `createChannel` is a _tracked_ poke whose watcher is
  fed by the subscription stream — so the poke created the channel and the
  tracker timed out 20s later, reporting failure for work that had landed.
  D50 makes a channel name single-use forever, so each retry burned one;
  two are permanently gone in `~zod/surface-seed`. The suite missed it
  because the command tests substitute a double for `authenticate`.

- **Every `append`-using app was unpublishable** (D72). Publish's
  post-write check compared the schema-validated read-back against the raw
  object it had written. The schema strips unknown keys, so the gate-only
  marker `duplicatesTolerated` was present in what was written and absent
  from what was compared, and a landed write reported
  `publish-unconfirmed` — through the exact opt-out the gate requires and
  the docs promise.

- **The shipped CLI could never find its own templates** (D73).
  `templatesRoot()` resolved from `__dirname` under a comment claiming the
  compiled binary keeps the source layout. `bun build --compile` bakes
  `__dirname` as a literal — confirmed by inspecting the binary and by
  running it from an unrelated directory. It is unfixable from inside: the
  binary ships in the platform package and `skills/` in the root wrapper.
  Fixed in `bin/tlon.js`, the one uncompiled component that knows where it
  lives. This mattered because `SKILL.md`'s first step is `surface
templates list` and its first rule is "adapt the closest template, never
  invent" — a skill that finds nothing degrades every run to the path the
  doctrine forbids.

- **The skill shipped nowhere** (D66 closure). Registration took **six**
  steps, not the four recorded: `package.json` `files`,
  `release-package.ts`, `release-utils.ts`'s tarball allowlist (which
  would have rejected every `skills/**` entry and hard-failed the
  release), `openclaw.plugin.json`, the Hermes adapter, plus
  `plugin.yaml`'s `optional_env` and the enumerating test in
  `test_tlon_tool.py`. The method generalises: grep an existing skill's
  name repo-wide before assuming a registration list is complete.

---

## 5. Corrections to claims made during the session

Recorded because the pattern matters more than the individual errors.

- **My CI fix does not run on this branch.** I wired
  `TLON_PREVIEW_BROWSER=1` and a chromium install into `bot-checks` and
  reported it verified. The local verification was real (23 pass + 1 skip
  → 24 pass), but `bot-checks` is gated on `app == 'false'`
  (`ci.yml:123`) and this branch changes `packages/app/**` and
  `apps/tlon-web/**`, so the job never runs here — `test-build` runs
  instead and sets no browser flag. The headless leg still skips on
  exactly the cross-package changes it was added to cover. Found by the
  correctness pass; verified independently against the workflow conditions
  and the branch's changed-path set.

- **I reported step 9 complete while two of its bullets were designed to
  trail step 8.** Both are genuinely closed now — template work suggested
  no jargon-denylist additions, and the gate did not change during
  promotion, the templates did — but calling it done while the thing it
  mirrored was still moving was wrong.

- **A subagent overstated a measurement into three files.** It reported
  that two galaxy sigils emit no glyph and render blank. Measured: each
  draws exactly one featureless glyph — a circle, a rect, a path —
  against a planet's four. It had counted only `<path>` elements. The
  conclusion held (use a planet in preview's synthetic crew); the severity
  did not. Corrected in all three places, with the error itself recorded
  so it is not re-derived.

- **I misread a test failure as a subagent misreporting.** `tlon-skill`
  runs under `bun test`; I ran it under vitest, which fails to collect on
  its `bun:test` imports. Run correctly: 7 pass.

- **My first framing of the validation finding was too narrow.** I
  attributed a near-miss to the test DOM lacking an API. True, but it only
  covers one shape; the handler case has nothing to do with the DOM
  implementation.

The common thread: every real defect this session was found by verifying a
claim rather than accepting it, and every bad claim came from reporting
before verifying.

---

## 6. Process note: the review had to be split

The single combined review that was planned is not runnable. The external
reviewer refused the work twice on cybersecurity-classifier grounds — the
second time after substantial analysis, while reading the sandbox
document. The refusal tracks the _subject matter_, not the phrasing, so no
rewording recovers it. The validation half was therefore rerouted to a
different reviewer, which is how §3 was produced.

Any future review of this subsystem needs the same split planned in
advance rather than discovered halfway through. The same constraint
applies to written reports: this document keeps §3 at the level of
engineering conclusions and leaves specifics in the repository, because a
report that cannot be opened is not a report.

---

## 7. Open decisions

1. **Enable the `frame-src` allowlist?** (§3, recommendation 1.)
2. **A fix-round budget, set before any fixing starts**, then dispositions
   and follow-up issues only. Fourteen findings; four are High and cause
   data loss; several others are claim-versus-measurement gaps that are
   cheap to fix and were expensive to find.
3. **Is `--preserve-state` usable before findings 1–3 are fixed?** Today a
   legal state above 64 KiB strands the channel permanently, and the
   doctrine tells the bot the failure was its own.

---

## 8. Carry-forward for Session 6

Session 6 builds seven more templates and `surface fork` against these
documents.

- **`surface fork` is the live target of the raw-versus-validated
  defect.** Republishing a validated spec would strip `duplicatesTolerated`
  from every forked `append` app **and** fail the fork's own gate on a
  bundle that passed at its source. Finding 2 above shows the same root
  cause is still live in `decideRevision`.
- **`PARADIGM.md` needs correcting before it is used as a template
  specification**, not after: the prescribed rollover can destroy data
  (finding 4), and §2's handler-table pattern and §13's "adding data is not
  a revision" rule are both new this session and untested by real template
  work.
- **Preview cannot fold host events** (D70), so host-is-the-clock
  templates capture only their pre-rollover half — for the workout
  tracker, the chart and history cards are empty in all twelve cells.
  `--host-ops` is the candidate fix.
- **Preview and production disagree on `preserveState`** (D69): preview
  snapshots the new `initialState` while production folds the carried
  state.
- **Under Hermes the skill is `SKILL.md` and nothing else** (D74), so
  `PARADIGM.md`, `PRIMITIVES.md`, `RUBRIC.md` and the templates are
  unreachable through the skill mechanism. The doctrine is load-bearing; a
  registered skill is not necessarily a readable one.
- **`surface publish` has no dev-storage path** and stops without an
  S3-compatible endpoint, so the loop is unrunnable locally as shipped.
- **The `countdown` template cannot work under the no-clock rule** (D67).

---

## 9. Verification

`api 1047` · `shared 620` · `app 539 +3 skipped` · `surface-shell 68` ·
`tlon-skill 845 pass / 1 skip / 4 fail` · `hermetic 362` · `openclaw 1491`
· `hermes 1193` (also under Python 3.10).

The four `tlon-skill` failures are pre-existing `media-guard.test.ts` TLS
cases; `git log develop..HEAD -- media-guard.test.ts` is empty. Build
smoke, typecheck and `oxfmt --check` are clean across the touched
packages.
