# Surface Channels v0 — Session 6d report (verification hardening)

Branch `patrick/mini-app-mvp`, PR #6380. Split-review-ready: each section is
self-contained, states what was measured and what was not, and names the
decision entry that carries it.

The session added **no capability**. Every item repaired an instrument, a
claim, or a record, and every one landed with a demonstrated failure — a
pre-fix failure or a caught mutation — because the house rule was held
literally this time: a guard enters the tree with its negative control
demonstrated, or it enters as a claim.

Two review documents accompany this one and are split on purpose (see §8):
`surface-channels-6d-review-containment.md` and
`surface-channels-6d-review-correctness.md`.

---

## §1 Part 0 — what the prompt assumed, and what was on the branch

Four things did not match.

**1. The CLI the bot invokes was stale.** The currency guard built last session
reported `STALE (sources-moved)`: the container binary was compiled
2026-09-01T22:39, and eight script files had moved since — `surface-lint.ts`,
`surface-publish.ts`, `surface-preview.ts`, `surface-transitions.ts`,
`surface-transition-fixtures.ts`, `surface-rubric-artifact.ts`,
`surface-common.ts`, plus the new `surface-initial-state.ts`. Any live gate or
preview run taken without rebuilding would have measured code that is not on
this branch. It mattered for items 7, 8 and 19; the controls for 7 and 8 run
through the local test suites rather than the container binary, and item 19
goes through the Vite server, so no stale reading was taken. **Rebuilt at
session end** — the container had exited cleanly two hours earlier and the
binary is built inside it, so bringing it back up with `TLON_SKILL_FROM_SOURCE=1`
was the whole fix. The stamp now reads CURRENT with all 74 sources matching. I
should have done that at the start rather than routing around it.

**2. "CI green, and it stays green" was true of the gating job only.**
`CI (Test and Build)` was `success` on `2c62221d7b`; the Hermes and OpenClaw
workflows were still `in_progress` on that head, both on a shared E2E job.
Neither had failed; the head simply was not fully verified when the prompt was
written.

**3. The fakeship desk is 76 commits behind HEAD** — benign, and checked rather
than assumed: the only file differing under `desk/` is `desk.docket-0`. Zero
Hoon divergence, consistent with the project's zero-new-Hoon premise.

**4. Item 18's stub is untracked**, so deleting it is a filesystem action with a
record, not something a reviewer sees in the diff.

---

## §2 Part I — the egress instrument (P0)

**The test protecting execution of untrusted model-generated JavaScript could
not fail.** All five probes targeted `https://beacon.invalid/`, an RFC-6761
name that can never resolve, so every "blocked" verdict was the branch a DNS
failure takes and the network-level backstop was satisfied the same way. The
correct harness — a real attacker server, mandated by D43 as the standard and
named in `navigation.spec.ts` by name as the anti-pattern `sandbox.spec.ts`
embodied — was ~400 lines away in the same suite and had never been
back-ported. **D171.**

Rebuilt on it. A blocked verdict is now zero connections observed at a server
that was listening and would have answered; every probe posts `probe-armed`
before firing; and the CSP-removed arm is a peer test rather than a comment.
The WebSocket probe needed an `upgrade` listener on the attacker — node routes
a handshake there and not to the request handler, so a connected WebSocket
would otherwise have left no trace, the same class of bug one level down.
`sendBeacon`'s transmission is now asserted at all, which its old comment
correctly disclaimed and then nothing replaced.

**The demonstration.** Deleting the CSP meta from `buildSandboxDocument` makes
the enforced arm fail with `fetch reached the attacker at /fetch — Expected: 0,
Received: 1`. The `.invalid` version survived that mutation unchanged.

**The `window.top` / `localStorage` confound was real, and measured rather than
reasoned about. D171.1.** On the old `about:blank` host the parent had an opaque
origin of its own, so those probes' refusal had two possible causes. Granting
`allow-same-origin` there leaves `localStorage` reporting `blocked` on all three
engines — the flag makes no difference, so the verdict was unattributable. The
suite now serves its host from a real origin where granting it does flip both
escapes, and that arm ships as a control.

**The Navigation API, deferred since D93, is measured. D171.2.** Chromium
reproduces the recorded finding exactly — under `A/no-csp` it reaches the
attacker and commits — and the shipped policy blocks it at preflight with zero
hits, with the allowlist-the-attacker controls landing so the block is
attributable to source matching. The API does not exist on firefox or webkit and
the probe **says so** (`API-ABSENT`) rather than navigating, because zero hits on
an engine lacking the API would otherwise be scored as containment — the same
substitution that made the original probes vacuous.

**D43's redirect residual is CLOSED. D171.3.** Outstanding since session 4 and
carried as D44's flip criterion 2. All three engines re-check the redirect target
against `frame-src`; the both-origins-allowlisted control confirms the hop is
reachable, so the refusal is about the destination. Still unmeasured from D43's
list: `data:` / `blob:` targets, named rather than dropped.

**The posture suite runs in CI and gates merges. D171.4.** It ran nowhere
before, so per-PR protection was a CSP _string_ pinned in a unit test. New
`sandbox-posture` job, `SANDBOX_ENGINES: all`, gated `app == 'true'` (the filter
covering both `apps/tlon-web/**` and `packages/surface-shell/**`), appended to
`ci-ok`'s `needs`.

**Four artifacts said `frame-src` ships disabled. It ships enforcing. D171.5.**
The prompt named three; the fourth was in plan §5's v0 security claim, the
sentence most likely to be quoted at someone — and a fifth surfaced later in
the how-it-works doc (§8). All corrected, and §5 now states
what the rebuilt suite demonstrates with its probe list. The honest residual is
stated where the claim is: `frame-src` is an origin allowlist, not a
prohibition.

**Result: 204 tests pass across chromium, firefox and webkit.**

---

## §3 Part II — the two checks that shipped bypassable (P1)

**The `$actor` exemption fell to MOVING the token, not removing it. D172.** The
gate's predicate was a faithful transliteration of the reducer's substituter,
recursive arms included — and the fidelity was the bug. Substitution is a
property of where the author put the token; ownership is a property of where the
op writes, which the gate never looked at. Three shapes burying the token in an
object value, a nested object value, and an array element all wrote shared paths
and all took the exemption. Narrowing to "the value IS exactly the token" closes
all three at zero cost: across nine templates the token appears in a value four
times, all in `expense-split`, all bare.

Control run in both directions: with the recursive arms restored the three
shapes report nothing; with the narrowing all three report.

**The finding text published its own bypass. D172.1.** The message named the
exemption's condition, and preview prints `finding.message` verbatim into the
defect list the generating model repairs against. Stripped; a test asserts the
message contains neither "exempt" nor "$actor".

**Nothing imported both readers, and now something does. D172.2.** The
differential test asserts the agreement that must hold and pins the divergence
that must not be closed. Widening the gate back to parity fails it — that edit
was made and reverted.

**A dead action shipped green. D173.** An op with partial-segment `$actor` is a
hard grammar refusal, so the action is declared, drawn, pressable and incapable
of moving the board. Every rule was structurally blind: pointer hygiene sees a
legal pointer; idempotency sees two identical states _because a refused fold is
trivially idempotent_; activation sees a control that invokes it; and
`no-op-control` excludes it because the walk skips aborted edges. New rule 18,
`inert-action`, reading the `abortedSequenceNums` the reducer already returned
and nothing had ever read. Control: the fixture lints `ok: true` with the rule
disabled, `ok: false` with it.

It also tripped `surfaces-eval-probe.ts`, which refuses to score when the gate
holds an unclassified rule — the D170 mechanism working twice in three days, on
the author who wrote the entry about it.

---

## §4 Part III — data consistency (P1)

**Duplicate sequence numbers made the fold order-dependent, and the property
meant to cover convergence excluded the case. D174.** All four order-invariance
properties shuffle a hand-built array whose sequence numbers come from a
strictly-increasing counter, so the failing input was outside the generator.
Duplicates are in it now. The tie-break is the host post id, compared
numerically — canonical ids are dot-grouped variable-length renders, so a plain
string compare puts `9` after `10`. Control: removing the tie-break fails the
property plus two ordering tests.

**An inflated `upToSequenceNum` could brick a channel permanently. D175.**
Hydration already held the server-advertised head and never passed it; it is
threaded through now, and selection skips any snapshot claiming coverage beyond
it — skipping rather than clamping, because a boundary that wrong means the
writer's state is untrustworthy too. Pinned deliberately: a caller supplying no
head gets the old behaviour, and a snapshot whose `upTo` equals the head exactly
is still accepted.

**`--preserve-state`'s semantic is a writer obligation, recorded as one. D176.**
Now in plan §4.3 and §7 alongside the snapshot obligation, and as a named
out-of-scope case in the hooks design note — both are host-authored and the
pre-filter must allow every host event, so neither is reachable there. No code
beyond tests pinning replace-wholesale as the contract.

---

## §5 Part IV — the render path (P2)

**A bundle throwing before `register` left a blank board, and wiring
`onShellError` would not have fixed it. D177.** The audit read this as an
unplumbed callback; it is worse. On a module-eval throw the shell posts **only
`ready`** — its script completed, the bundle's separate script aborted,
registration never happened. There was no error message to route. The shell now
installs window handlers that report while no app is registered; the host
renders a defined halted state with a reload that bumps the session key rather
than reassigning `srcdoc`. Control: a reference error on line one reports; with
the handlers removed the report array is empty. Pinned too: a _render_-phase
error must not trigger it, since the shell already handles that in-frame.

**The two halves were each tested against a fake of the other. D178.** The host
suite mocks the shell to a no-op and hand-dispatches the handshake; the shell
suite drives a hand-rolled frame with no validation. Both were green while
D177's bug was live. `composed.spec.ts` runs the real shell artifact in a real
frame driven by the real session layer with validation and the revision check
active.

Two of my own errors, caught in the writing: a stale-revision test on a false
premise (the session _sends_ its spec, so the shell echoes it back and the two
cannot disagree), rewritten to assert that premise compositionally; and a "the
frame is blank" assertion reading `contentDocument` across an opaque origin,
where it is null and the check would pass either way — removed before it
shipped, from the file whose purpose is removing exactly that.

**The hydration hook had no test, and its predicate is the only thing that ever
refreshes a board. D184.** Under `staleTime: Infinity` nothing goes stale with
time. The key is now exported so a test asserts the real one, and the tests
drive the real invalidation path with real writes rather than re-implementing
the predicate. Control: moving the deps Set off index 1 fails **three** tests —
the board keeps rendering its first fold forever.

---

## §6 Part V — record, parity, hygiene

**The decision record's location is checked mechanically. D179.** Three entries
have gone to the wrong file, the third on the day the manual check was written
down. `scripts/check-decisions-record.mjs` fails on a second record anywhere, and
on any document citing a decision the tracked file does not define. It runs in
`ci-config-check` — the one job with no path filter — because a stray root file
matches no filter and a gated guard would be skipped exactly when needed. **It
caught this session's own forward references on its first run.** Stated rather
than implied: there is no working pre-commit hook to attach it to; the configured
hooks path points outside the repo at a file that does not exist.

**The NUL separators are gone, and the fix is an injective join. D180.** The
obvious fix is wrong: those separators were collision-proof for a real reason
(`canonicalJson` escapes control characters, so no token can contain one), and
every printable candidate can appear in a value, where a collision silently
merges two groups into one wrong row. Signatures are now `JSON.stringify` of an
array. Consequence recorded because it is not cosmetic: the scorer's digest
changed, so the eval baseline was regenerated in the same commit.

**Plan parity: the key is `~zod`, not `~0zod`. D181.** Escaping is a property of
the pointer's text, never of the key the write lands on. **The parity check the
prompt asked for cannot be run from this repo** — there is no Python surface
implementation here; the adapter has 53 `.py` files and zero hits for the token,
the placeholder, or any pointer or spec symbol. Recorded as open against the
out-of-tree repo rather than answered by inference. This is a STOP-and-report in
the sense the prompt meant: not a disagreement, an unanswerable question.

**Housekeeping. D183.** The truncated 309-byte stub deleted; the two seed
fixtures that cannot pass the gate they predate marked ungated-by-design with
the note that the right resolution is neither renaming the fixture nor weakening
the rule; all 29 `data-testid` attributes removed from the templates, with
`PRIMITIVES.md` now saying not to write them. One recorded-not-fixed: a host op
can write a literal `$actor` object _key_, contradicting a doc comment (**D182**).

**The orphan `dash-ltjbt690` was NOT cleared.** It is a dev-ship artifact with
no repo footprint, and clearing it is a ship-side write; with the CLI stale at
the time and the `--ship` flag off limits I left it rather than improvise a
write path. The CLI has since been rebuilt (§1), so that reason no longer holds. It is
visible in the §7 capture, in the sidebar, as "Dev storage E2E".

---

## §7 Part V item 19 — actually looking, which found two things and unfound a third

Verified in a browser, screenshots in `audit-notes/screens/`. **D185.**

Text matches the seed doc on all four fixtures; the oversized Retry does
re-fetch; the invalid fixture's surface-event post correctly appears only in the
sidebar preview and never in the main pane. Then:

**The migration spinner is invisible. It rotates and paints nothing.** The
element is present, sized, visible and demonstrably animating — and both circles
compute to `stroke: none` and `fill: none`. `LoadingSpinner` passes
`color={color ?? '$color.gray700'}`, and `$color.gray700` is **the only use of
the `$color.` dotted namespace anywhere in `packages/ui/src` or
`packages/app`**; every other component uses a bare theme key. The token exists;
that reference form does not resolve. I confirmed the blank region in the
capture myself rather than taking the report on trust.

**This is the session's own thesis arriving from outside.** A DOM assertion sees
a spinner. A `visibility`/`opacity` check sees a spinner. A user sees two lines
of text and no motion. Nothing short of looking at pixels catches it.

**Not fixed here, deliberately:** 33 `<LoadingSpinner />` call sites carry no
explicit colour across three packages, so the one-line change is an app-wide
visual change well outside a verification-hardening session, and I cannot
confirm the corrected token renders without a browser pass over those screens.

**The mechanism, from source rather than the browser**, which also rules out the
environment hazard below as a cause since this path never touches CSS
extraction: `Spinner.mjs` looks `'$color.gray700'` up as a THEME key and misses;
`variableToString` turns the miss into an **empty string**, not `undefined`; and
RNW's `ActivityIndicator` applies its `#1976D2` default only on `void 0`, so the
empty string defeats the fallback and reaches `stroke: ''` → computed `none`.

**One finding withdrawn.** I first recorded that Retry produces no perceptible
feedback, from a browser observation sampling the DOM every 100ms for 2s. It
does not hold: `retry` sets the loading phase synchronously and the mapper
renders a loading view with text. A localhost fetch finishes in single-digit
milliseconds, so the sampler would miss a state that genuinely mounted. I
accepted it because it sat next to a real finding — the same reflex that let
synthetic preview captures be reported as three shipped defects in 6c (D169).
The seed doc's two trailing-period quotes do hold.

An environment hazard worth knowing: both dev servers were serving a white
screen from a `@tamagui/vite-plugin` v2.4.2 cache bug — the extraction cache
lives on `globalThis` while the map resolving the emitted `.tamagui.css` imports
is per-plugin-instance, so a warm global cache makes every tamagui file emit an
unresolvable import. It does not self-heal on reload.

---

## §8 Part VI — the two deliverables

`surface-channels-claims-index.md` — every claim in the plan, the PR description
and the how-it-works doc, with its control, that control's negative control, and
the head it was last verified at. **Rows that could not be filled are listed at
the top as findings**, which is the point of the document.

`surface-channels-6d-review-containment.md` and
`-correctness.md` — the fix-diff summary, split per the §6 constraint from the
fix-round summary: sustained sandbox-escape analysis has twice been refused by an
external provider's classifier, and the refusal tracks subject matter rather than
phrasing. The containment half stays at the level of engineering conclusions with
specifics left in the repository.

**The index earned its keep immediately. D186.** 126 claims enumerated, 97 with
a control, 89 of those with a demonstrated negative control, 29 with none — and
**five claims that are not merely uncontrolled but false at this head**, each
verified by me before acting:

1. **"Boundary checks: import allowlist, style boundary, token drift,
   deterministic build" — claimed CI-enforced, ran nowhere.** All four scripts
   exist behind `packages/surface-shell`'s `check:all` and nothing invoked
   them: not `pnpm -r lint` (oxlint only), not `test:ci` (vitest only), no
   workflow. `check-token-drift.mjs` asserts in its own output that it "fails
   CI when this file is stale". **Wired rather than the claim weakened**, since
   all four pass today.
2. `how-it-works.md:93` said the host CSP "ships disabled" — the **fifth** copy
   of the error D171.5 corrected in four other places. Five copies of one stale
   fact across four artifacts is itself the finding.
3. The PR description said the gate runs "fifteen rules" (seventeen before this
   session, eighteen after).
4. The PR description listed `surface fork` under "Not built". It is built,
   registered, and has 51 test cases.
5. Plan §7's caps table stated `provenance` as 512 B against a constant of 1024.

**The structural reason all five survived:** `surface-doc-constants.test.ts`
pins only the four SKILL documents, so the plan, the how-it-works doc and the PR
body have no drift control at all. Deliberately not fixed by extending that test
— the skill docs are what a bot reads and are already pinned, the plan is read
by humans, and a repo-root reader inside a skill-scoped test is machinery out of
proportion to the blast radius. The index is the control for that class now, and
it is tracked.

**The PR description was then rewritten** rather than patched: beyond the two
false claims above, its framing was a milestone stale (it still described a
format decision "which gates the rest of M2" and "the remaining seven templates
gated on it", when all nine ship), its diff size was 299 files/+60.9k against a
real 452/+97.7k, its per-package test inventory was stale in all six numbers,
and its revision-measurement paragraph quoted classifier outputs now known wrong
in both directions (D164, D166) without saying so.

---

## §9 Verification at the final state

Two heads were pushed. The session's work is `f579f64140`; a merge of `develop`
on top of it is `d633eb9c3c`, needed because a `pnpm-lock.yaml` conflict was
blocking CI from running on the PR at all — something I should have checked
before setting a CI watcher, and did not. The lockfile was regenerated from the
merged `package.json` set rather than hand-resolved; the three other files
touched on both sides auto-merged.

At `d633eb9c3c`, locally:

- `pnpm install --frozen-lockfile` (what CI runs) — passes
- `pnpm format:check` — clean, 1966 files
- `pnpm -r tsc` — clean
- `pnpm test:ci` — shared 646, app 614 (3 skipped), surface-shell 103, ui 5,
  scripts 3, all pass
- `packages/tlon-skill` — 1408 pass / 13 skip / 4 fail; the 4 are the known
  local media-guard TLS artifacts, identical to the session baseline, and pass
  in CI
- `SANDBOX_ENGINES=all pnpm e2e:sandbox` — **204 passed**, chromium + firefox +
  webkit (run at `f579f64140`; the merge touched none of its inputs)
- `node scripts/check-decisions-record.mjs` — OK
- CLI build stamp — **CURRENT**, 74/74 sources matching

CI on `d633eb9c3c` — `CI (Test and Build)`, the gating workflow: **success**.
Every job passed or was skipped by its path filter: `CI Config Check` (carrying
the new decision-record guard), `test-build` (now carrying the shell's four
boundary checks), `Production Build Smoke Test`, `E2E Tests (Parallel - 4
shards)`, `Sandbox Posture (3 engines)`, and `CI OK`, the merge gate.

The posture job's first-ever CI run is confirmed from its raw log rather than
from its status: `Running 204 tests using 1 worker` → `204 passed (7.2m)`, 68 per
engine, with the composed test, the D43 redirect residual and the Navigation API
probe all present as passes. A job that passes on zero tests is the class this
session exists to remove, so the count is the claim, not the green tick.

One correction to my own reading, kept because it is the session's pattern in
miniature: while the E2E shards were running I reported them at "2h24m against
a 24-minute baseline, almost certainly wedged." They took 25 minutes. I had
converted local time to UTC with the wrong offset, and the one datum that
contradicted me — a `BlobNotFound` response stamped with the real UTC time — I
waved off as a stale cache. Nothing was anomalous; the alarm was arithmetic.

The two sibling workflows at the time of this push — Hermes Tlon Adapter CI: in_progress; OpenClaw Plugin CI: in_progress
— are separate from the merge gate; both passed on the previous head.

---

## §10 What this session did not do

- **Native containment.** Everything in §2 is web. iOS and Android have no
  mechanism and no test; that was true before and is true after. It is the
  largest remaining gap in the containment story.
- **`data:` / `blob:` navigation targets**, the other half of D43's residual.
- **The spinner fix**, for the blast-radius reason in §7 — 33 call sites across
  three packages make a one-line change an app-wide visual change.
- **The orphan channel.** Declined mid-session while the CLI was stale; now that
  the CLI is rebuilt the block is gone and it is simply not done.
- **The Python parity check**, which is not answerable from this repo.

---

## Notes for M3

**The M3 list changes in four places.**

1. **"Instrument replacement" should be re-scoped.** M3 carried it as a general
   item; §2 and §3 have now replaced the instruments that were known to be
   broken. What remains is the question §2 raises and does not answer: _what
   else about the posture suite could silently stop measuring?_ The mutation I
   ran removes the policy. I did not enumerate the ways an instrument can fail
   while still reporting armed, and that enumeration is the M3-sized piece.

2. **Add the native containment gap as its own item, not a sub-bullet.** M0's
   "leak test on all three platforms" is unmet for two of three, visible only
   inside a source comment. Web now has a real instrument in CI, which makes the
   asymmetry starker rather than better.

3. **The integrated verification pass should assume the claims index exists.**
   Its unfillable rows are a worked backlog for that pass — start from them
   rather than re-deriving what is unverified.

4. **Add a UI-renders-what-it-claims item.** §7 found a defined §6 state that
   is present in the DOM, passes every structural assertion, and paints nothing.
   The representative-populated-states work already on the M3 list is the right
   home for it, but it needs to be scored on pixels rather than on the DOM, or
   it will reproduce the exact defect it is meant to catch.

**One thing to carry as a habit rather than an item.** Almost everything found
across 6c and 6d was a guard that could not fail or a claim nobody checked, and
in both sessions the highest-value findings came from leaving the code — running
the mutation, opening the browser. The cheapest available next step is not
another review pass over the same text; it is picking the next claim that has
never been executed and executing it.
