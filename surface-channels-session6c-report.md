# Surface Channels v0 — Session 6c report (M2 close-out)

Branch `patrick/mini-app-mvp`, PR #6380. Split-review-ready: each section is
self-contained, states what was measured and what was not, and names the
decision entry that carries it.

Sections §1–§7 are final. §8 (the transition graph) and §9 (the live loop) are
marked in place if they are still open at the time you read this.

---

## §1 Part 0 — what the prompt assumed, and what was actually on the branch

The prompt opens by declaring provisioning closed and pointing at head
`691c73fbb5`, CI green. Four of its assumptions did not survive contact.

**1. The head had moved, and the record it told me to continue from was not
committed.** Head was `d1803fb194`, two docs commits further on. More
seriously, `git show HEAD:DECISIONS.md` ended at **D148**: the prompt says
"continue from D149", and D149 did not exist in the tracked file. It had been
written to an untracked `packages/tlon-skill/DECISIONS.md` — a relative path
resolving under a `cd` that persisted from an earlier command — so the commit
titled "docs: the aged-board revision" contained the report's §7 and not the
decision entry it claimed. Appended to the tracked file, stray removed. **D151.**

Recorded rather than merely fixed, because the failure mode is invisible by
construction: writing a file always succeeds, and the session that wrote it
reports success. The check that catches it is `grep` from the repo root, and it
costs nothing.

**2. One of the two Part I controls could not draw the defect assigned to it,
and would have forced a false positive on a shipped template.** The prompt
says _"the 6a.5 inert expense app must draw the unreachable-actions defect."_
That app ships:

```
expense-v1   actions: {}   invoke( sites: 0   memberInteraction: "none"
countdown    actions: {}   invoke( sites: 0   memberInteraction: {mode:'none', because:…}
```

With no declared actions, "every declared action no control reaches" is the
empty set and the assertion passes vacuously — species 4 of this project's own
vacuous-guard taxonomy, in the prompt that commissions the fix. Worse, it is
structurally identical to the shipped `countdown` template under a transition
pass: one state, no edges. Any rule that fires on the expense app fires on
`countdown`.

Its actual defect — an expense split nobody can add to, _declared_ display-only
so the warning would not fire — is already caught by rubric check 8
(`display-only-was-asked-for`), which D133 records publish refusing with
`rubric-incomplete`. The transition pass drawing nothing on it is correct
behaviour, not a miss. So the unreachable-actions control had to be built,
against an app that genuinely declares an action no control reaches.

**3. `countdown` cannot satisfy the definition of done as written.** The DoD
requires _"nine of nine templates … with member interactions observed by
scry."_ `countdown` declares `{mode:'none'}` with zero actions; there is no
member interaction to observe, by design and by its own `because` sentence.
Carved out explicitly with its reason rather than counting eight as nine — see
§9.

**4. Part IV.1's fix is not fork-local**, and the prompt describes it as if it
were. `requireCompletedRubric` lives in `surface-publish.ts` and publish calls
it too, so the change alters publish's contract and invalidates every existing
rubric artifact. That compatibility decision had to be made explicitly; it is
in §5.

Smaller corrections folded into the record: the plan still carried both
provisioning items as **"Blocking for M2"** (§7), and §9 of the plan said
templates ship `app.html` when they ship `app.js` + `spec.json` + `NOTES.md` +
`state.json`.

---

## §2 The CI failure, root-caused — and the belief it corrected

`d1803fb194` failed CI on one test:

```
(fail) headless capture — the defect pass against a real browser
       > finds nothing in the poll fixture, measured the same way [120000.07ms]
  ^ this test timed out after 120000ms
```

It was not a regression: the entire diff from the last green head is one JSON
request record and a markdown report — no code, no tests.

**The diagnosis I brought to it was wrong, and measurement refuted it.** I
attributed the hang to Chromium exhausting after several sequential
`chromium.launch()` calls, because that is the failure this project had already
hit in the templates suite. Three sequential in-process launches pass 3/3 in
26s. A tracing proxy around the launcher put the hang inside **`page.close()`**
— Playwright's `Page.close()` is a raw protocol call with **no timeout**
(`playwright-core/lib/client/page.js:509-522`), so a browser that stops
answering hangs forever and bun's 120s deadline is the only thing that ends it.

The real trigger is a combination:

| sequence                                         | result   |
| ------------------------------------------------ | -------- |
| 3 in-process launches, no spawn                  | PASS ×3  |
| spawn, then 1 in-process launch                  | PASS     |
| in-process launch → 4 spawns → in-process launch | FAIL 2/2 |

`surface-preview.test.ts` already contained a spawn arm — the determinism
control's private `captureInSubprocess` — sitting between two in-process
browser tests. So the file has carried the pattern since that control was
written and passed CI twice on luck. **It reproduces locally 2/2**; it was
never CI-only. Nobody had ever run that file by itself.

Fixed by routing all four browser tests through one shared
`previewInSubprocess()`, collapsing the private spawn helper into it so the mix
cannot be reintroduced by a browser test appended later.

```
TLON_PREVIEW_BROWSER=1 bun test surface-preview.test.ts surface-templates.test.ts
run 3×:  89 pass, 0 fail, 379 expect()  —  142.17s / 141.99s / 142.65s
```

Mutation-checked: pointing the "finds nothing" arm at `DEFECTIVE_BUNDLE` fails
it with the full 74-line defect diff, so the subprocess path really drives a
browser and the manifest survives the process boundary. **D154.**

Two lessons carried out of it, both cheap and both earned here. A diagnosis
inherited from a similar-looking failure is a hypothesis, not a cause. And a
test file that passes in a suite and has never been run alone has not been
measured — the isolation run is the cheapest experiment available, and it
reproduced on the first try.

**Not claimed:** the mechanism inside Bun/Playwright. It is consistent with
`Bun.spawn` perturbing the fd bookkeeping Playwright's pipe transport depends
on; that was not proven, and is not asserted.

---

## §3 Part II — the `ListRow` secondary slot

`PRIMITIVES.md` documented `ListRow` with three props and no secondary-text
slot, so 8 of 9 templates hand-rolled stacked `<div>`s and rendered two or
three equal-weight lines per row. Thirteen sites, not the twelve expected —
kanban's card has four children.

**The design question turned on the five three-line sites**, and inspection
answered it: in three of them the third element is not text at all
(habit-tracker's facepile, workout-tracker's deload badges, leaderboard's
`Progress`). Since `secondary` renders _after_ `children`, leaving those in
`children` would float them above the supporting text. So the slot takes nodes
and owns the supporting cluster's rhythm. The "two equal-weight lines rebuilds
the problem" objection does not apply: the missing hierarchy is
title-vs-supporting, and "3 of 4 today" and "✓ · ✓" are peers.

Token-styled from the existing set (`--text-s`, `--color-text-secondary`,
`--line-s`, `--space-2xs`); the muted type is set on the container, so
`Avatar`, `Badge` and `Progress` keep their own color and size.

**One exception, written into the document rather than into a comment.**
`kanban`'s card puts three wrapping move-buttons in `secondary` rather than
`right`, because in the trailing slot they take most of a phone's width. A
comment in the one template that does it is the wrong instrument — the bot
copies template code far more readily than it obeys a comment — so
`PRIMITIVES.md` now states the rule, the exception, and the reason the rule
needs stating at all: a `Button` in `secondary` keeps its own color and
therefore _looks_ fine. **D155.**

```
surface-shell vitest      103 pass (was 100; +3 incl. an explicit additivity assertion)
check:all                 dependency / style / token-drift / deterministic-build — pass
surface-templates.test.ts 37 pass, 0 fail, 108 expect() with browser, 81.4s
gate + scan + runtime     184 pass, 9 skip, 0 fail across 4 files
tsc exit 0                oxfmt --check clean on all 14 files
```

The template test asserts `violations`, `warnings` **and** `skipped` all empty
per template, so a green template test _is_ the publish gate on every migrated
template — confirmed by reading the assertion, not assumed.

**Verified visually, not just mechanically:** real Chromium screenshots on
habit-tracker, leaderboard and kanban, `defects=[] shellErrors=[]`, including
the leaderboard's positive-tone `Badge` keeping its color inside the muted
container. **Not checked by eye:** the other five migrated templates (machine
pass only), and light/dark for every template — three were viewed, one theme
each.

---

## §4 Part IV.3 and IV.4 — two closures, one by reading

**The cwd-dependent gate failure stays recorded as unreproduced**, with its
symptom named so a recurrence is diagnosed rather than rediscovered: the gate
failing for a template that passes from the package directory but not from the
repo root, with `Attempting to define property on object that is not
extensible`. The class was fixed — such a failure now reports
`gate-harness-unavailable` and tells the author the environment is implicated
and not their files — but the cause was never reproduced after a `dist`
rebuild and is not claimed. **D152.**

**`surface publish` uploads through the same hosted helper the CLI's image
upload uses.** `surface-publish.ts:1017` → `deps.uploadBundle` →
`uploadBundleToShipStorage` → `uploadFile` from `@tloncorp/api`; the CLI's image
upload reaches the identical `packages/api/src/client/storageApi.ts:195`. Both
pass `hostedDetection: 'assume-hosted'` under `TLON_HOSTING`, and the helper
forces the memex branch, which PUTs to a presigned URL and never constructs an
S3 client. So a hosted moon's lack of S3 credentials — by design — is not a
problem publish has to solve. **D153.**

Checked by reading, because the claim is about which function is called and
reading is the direct evidence for that. **What reading does not establish** is
that a hosted moon's publish succeeds end to end; that needs the first rollout
ring (§7).

---

## §5 Part IV.1 — the rubric sheet binds the spec, not only the bytes

A sheet bound only `(surfaceId, bundleSha256)`, so a revision that changed the
spec but not the bundle kept a stale sheet valid and landed a definition whose
preview cells were never rendered. The plan had carried this as a known
residual since Session 6b.

**The evidence that it was live rather than theoretical: 17 existing publish
tests broke** on the new binding — every one a spec-only change (a title
rename, a `preserveState` flip, an added undeclared key) that had been sailing
through on a stale sheet.

**Refuse, with no lenient path**, and the argument is sharper than "be strict":
the lenient path's bypass is `delete sheet.specSha256`. A binding an author can
satisfy by _removing_ a line is not a binding. There is also nothing honest to
migrate to — the field is a claim about what the scorer was looking at, so
filling it in from the current spec would be the tool asserting the very thing
it exists to verify.

**D72 (raw-to-raw) honoured and proved rather than asserted.** The hash is
`sha256(canonicalJson(spec))` over the verbatim parsed spec at all three ends,
never the validated view. `canonicalJson` erases only key order and `undefined`
values, neither of which can reach a channel description cell — so every
difference it hides is one no reader could observe. Executable against the real
schema:

```
surfaceSpecHash(raw_with_undeclared_key) !== surfaceSpecHash(raw)
surfaceSpecHash(schema.parse(a))          === surfaceSpecHash(schema.parse(b))
```

If anyone moves the hash onto the validated view, that assertion is what fails.

Two mutations, both verified applied: deleting the spec comparison fails
exactly six tests across publish and fork and nothing else; accepting a missing
hash fails exactly the four compatibility tests. Positive controls kept
separate so a refuse-everything guard cannot pass — including one asserting
that key _reordering_ does not invalidate a sheet. `129 pass / 0 fail` across
the three files. **D156.**

**It found the same defect one level down, and that is being closed too.**
`surface preview --state <file>` renders the twelve cells from a supplied
state, and nothing binds it — so a sheet can name the right bundle and the
right spec while its images came from a starting state the spec never produces.
This is reachable through the bot's own documented workflow, not a corner case:
`RUBRIC.md:301` instructs the scorer to do _"a separate `--state` run against
the example board"_, and `countdown/NOTES.md:170` says the `--state` run is
_"the only run that exercises 'Passed'"_.

---

## §6 Part IV.2 — D136.6 ruled

D136.6 recorded a contradiction and deferred it: an author wanted spare cost
slots so a mid-trip cost could be added by one host event rather than a
revision. It lints clean as an app but is unbuildable as a _template_, because
`surface-templates.test.ts` requires the skip list to be empty.

**Both sides are right, and the prompt's framing — "one of them is wrong" — is
what needed correcting.** The gate treats an unpressed control as a
_measurement_ gap: four rules in `ACTIVATION_WIDENED_RULES` are silent about a
handler that never ran, and reporting that as a clean pass is the failure the
skip discipline exists to prevent. The template test treats any skip as a
defect of the app, which is a reasonable bar for a golden exemplar.

What forces them into contradiction is a third thing neither states: **lint
activates at depth 1 only** (`surface-lint.ts:2503-2540` renders the initial
state, then each single declared action folded once from initial). A control
that appears two presses in is indistinguishable from a control that appears
never. Lint's skip is honest about its own blindness; the template test reads
that blindness as a property of the app.

The transition pass settles it, and the three cases separate cleanly:

- a control gated on a **member** action — the graph reaches it, the gate
  presses it there, the four widened rules get scored, **no skip**;
- a control gated on a **host** event — the graph is seeded from a declared
  host-ops set and reaches it, same result;
- a control **no reachable state renders** — a real `unreachable-action`
  violation, not a skip.

The spare-cost-slots pattern becomes buildable as a template under an
**unchanged** `skipped: []` assertion. Nothing had to be relaxed, which is the
outcome that says the ruling is right rather than merely decisive.

**One honest caveat on the second leg.** D70 built the `--host-ops` flag on
`surface preview`; templates ship `app.js`, `spec.json`, `NOTES.md` and
`state.json` and carry **no host-ops seed**. So the host-gated case needs a
per-template seed file that does not exist yet. No current template uses the
pattern, so nothing is blocked; the ruling makes it buildable and names the one
file that would have to come with it. The member-gated leg, which is the one
that actually resolves the contradiction, needs nothing new.

---

## §7 Part V — provisioning closed, and the rollout written down

**Both M0 provisioning items were satisfied by production infrastructure all
along, and were carried as "the hard dependency" in every report from Session 5
through 6b without one probe.** The moon's storage write is provided by memex's
design (a moon's uploads resolve to the parent planet's storage; `tlawn.py`
already sets `%presigned-url` and `TLON_HOSTING=1`), and the moon **is** an
admin of the user's personal group at onboarding — verified live on a hosted
ship by Patrick, 2026-09-01.

The dev-storage stub and the seed's role grant were stand-ins **for
fakeships**, never for production. That distinction is the whole error: a local
workaround was read as evidence that the real thing was missing. The cost of
the probe was a question to someone with a hosted ship; the cost of not asking
was four sessions of a blocking item that was never blocking.

**The generalisable part, and the reason this is a decision and not a status
update:** a dependency inherited from a prior session's report is inherited as
a _claim_, not as evidence. It gets a probe the first time it is load-bearing,
or it gets labelled unverified. This project already has that rule pointed at
guards — exercise the mechanism through the path the real actor uses — and
this is the same rule pointed at an assumption. **D150.**

The plan moves both items to _done, with evidence_, struck through rather than
deleted, so the record shows what was believed and what closed it.

### Rollout (new section in the plan)

The rings are the plugin ref, because there is no per-user flag:

1. **A branch-pinned single test bot** — where M2's exit criterion becomes
   literally runnable: a one-sentence request, a dashboard in the user's
   personal group.
2. **`develop`** — every internal employee's bot; the dogfood ring, and the
   first time the loop meets requests nobody wrote the templates for.
3. **`master`** — launch, fleet-wide. The client release that renders surfaces
   must land before or alongside it; a bot publishing a surface to a client
   that cannot render it produces a channel of unreadable posts.

**What blocks ring 1 is not in this repo.** A hosted bot's plugin is cloned
from `tloncorp/tlon-apps` at boot by `tlawn.py` (sparse checkout of
`packages/openclaw` + `packages/api`, built from repo) at a per-ship ref
(`spec.tlawn.pluginBranch`, or `TLON_PLUGIN_REF` via `tlawn.env`; default
`develop` internally, `master` otherwise) — **but `@tloncorp/tlon-skill`
resolves from the npm registry, not from the checkout.** So pinning a bot to
this branch delivers the plugin and not the surfaces skill. Closing it is a
tlonbot-side change: extend the from-repo build/pack path to
`packages/tlon-skill`, mirroring `TLON_API_FROM_REPO`; a prerelease publish is
the stopgap. Until one exists, ring 1 cannot be entered.

### What remains in M2, and where it runs

- **The eval corpus run** — bot harness, `surfaces-eval-run.sh`; the scoreboard
  replaces the baseline. May run against a branch-pinned hosted ship rather
  than fakeships. Outside build sessions.
- **Skill delivery to a hosted bot** — the tlonbot change above.

---

## §8 Part I — the transition graph

`surface preview` now walks the reachable-state graph. **kanban-v2 — the app
check 7 passed — draws the defect, through the real CLI end to end:**

```
[rubric 7: mandatory-checkpoint] "done" at /tasks/*/status is reachable only through
  "doing", then "blocked" — every sequence of presses that gets there passes through
  them first. If that is not a step of the real process, the control that skips it is missing
      seen in: the walk over 4096 reachable screen(s), not in any one capture

Reachability (closed: all 4096 reachable screen(s) explored, 24576 press(es), 18 deep)
```

Closed, not truncated, in ~2.1s. **All 24 declared actions are reachable — the
defect is the ORDER, not a missing control**, which is exactly what a still
cannot show and why check 7 passed it.

**The design, and why it is cheap.** Edges come from the real client reducer;
the browser only learns which controls a state renders. Actions are
parameterless, so a transition is a pure function. The edge set out of a state
is *the actions the controls rendered in that state actually invoke* — not the
declared list. That single distinction is the whole difference from what the
gate already did, since lint activates at depth 1 only. The walk runs in
happy-dom through the same fixture runner the gate uses, so none of it is
browser-gated. `activateControls` and its recorder were **extracted** from
`surface-lint.ts` (506 lines moved), not reimplemented — a parallel copy would
have been the defect this pass exists to find, in the pass itself.

**Soundness was checked, not assumed.** Mandatory checkpoints are dominators
computed on *projected* graphs, one per varying state pointer. Every explored
edge S→T contributes π(S)→π(T), so the image of any real path is a walk in the
projection; dominance transfers because the projection **over**-approximates
paths. Two things break that, and the second was found during the build:
truncation (a truncated walk projects *fewer* edges, and a missing edge is
exactly the bypass), and **value-domain overflow, which drops values so some
states project to nothing — an under-approximation, the one direction that is
unsound.** Overflowed projections are skipped. The same reasoning caught a
third case: a handler calling `invoke()` twice produces a state a
one-fold-per-press walk has no node for, so those presses become a shortfall,
and a shortfall makes the graph not-closed.

**The controls, both directions.** The unreachable-action control had to be
**built** — see §1.2 for why the app the prompt named would have passed
vacuously. Its positive twin changes one condition and **its edges all
originate at depth 2**, which is the point: the gate's depth-1 walk cannot see
a control two presses in.

Nine templates draw nothing and **eight of nine close**, so that is an
assertion rather than a truncation dodge. `kanban` truncates at 24577 states
and therefore asserts nothing, said plainly; a test pins that **at most one**
template may truncate, so a change making everything truncate — which would
make the clean result vacuous — fails. In the other direction a scorer that
flags everything is asserted to *fail* the clean-template check.

One synthetic control failed first, correctly, and is worth quoting:

> my first version of this test asserted "no checkpoint at all" and **failed**,
> correctly: Doing really is still mandatory. I fixed the assertion, not the code.

**Check 7's sheet entry now carries a machine-stamped citation** with three
markers so a walk that did not finish cannot read as one that found nothing:

```
kanban-v2  → "measured: closed over all 4096 reachable screen(s) — 2 finding(s): …"
kanban     → "not measured: the walk covered 6000 screen(s) and stopped before it had
              them all … so a path it never took could contradict anything it saw.
              Score check 7 from the captures and the request alone, as it was scored
              before the walk existed"
```

`not measured:` also covers a shortfall, not only a spent bound — a shortfall
is a missing edge, and a missing edge is the one thing dominance cannot
survive. Stamped unconditionally and required by the validator, for D157's
reason: optional is precisely how "we did not walk it" and "we walked it and it
was fine" become one emission. **D158, D161.**

**The gate was not rewired onto the graph, deliberately** — every behavioural
rule inspects each rendered state, so a gate on the real graph would inspect
4096 states on every publish. That is a different gate. Instead both signals
now say which question they answer; see §6. **D159.**

**What the pass cannot see**, printed on every run including clean ones:
whether the reachable states are the states the *request* implies (check 7
stays a human check, now scored against a reachability report instead of a
still); anything a control does that is not `invoke`; a second member; the
other theme and the read-only screen; anything the host does; and whether a
reachable screen is any good — reachable and legible are different questions.

```
surface-transitions.test.ts   52 pass, 0 fail    surface-lint.test.ts      138 pass
commands/surface-preview      25 pass, 0 fail    surface-rubric-artifact    35 pass
commands/surface-publish      74 pass, 0 fail    commands/surface-fork      43 pass
tlon-skill whole package    1291 pass, 13 skip, 4 fail (the known local media-guard four)
```

Three mutations on the citation, each verified applied. One **did not apply**
on the first attempt — oxfmt had removed a trailing comma, so the patch text
did not match — and the explicit applied-check caught it printing NOT APPLIED
with the suite still green. That is the exact case where a mutation test
silently proves nothing.

---

## §8.5 Two guards that were not in the prompt

**The CLI the bot invokes did not contain the work being measured.** The
container drives a `bun --compile` binary; today's was older than **16 compiled
sources, 13 of them in the traced import closure**, including every file Parts
I and IV.1 touched. The fence preflight provably cannot catch this — it probes
whether the CLI refuses a malformed or absent scope file, and the fence existed
when that binary was built, so a stale binary passes all three arms. **This is
D135's hole one level up:** the guard verified the instrument and said nothing
about whether the actor carried the work.

Closed by mirroring what the repo already does for the Hoon desk — digest the
sources, compare to what is deployed, refuse with a named remedy. Contents not
mtimes; `skills/**` excluded because it is runtime data and a guard that cries
wolf gets disabled; and the stamp names the **binary** too, hashed *inside the
container at the path the bot's tool call resolves*, because a certificate can
outlive its artifact. First run: **DIFFERS**. **D160.**

Known gap: `@tloncorp/api` and `@tloncorp/surface-shell` compile into the
binary and are outside the digest.

**The eval scoreboard's negative control caught a fabricated author-error.**
D157's pre-binding tolerance for historical rubric recordings is a
hand-maintained list, and hours later check 7 gained a required field the list
did not grow to cover — so `NEGATIVE CONTROL — the clean run scores as clean`
began failing, with every axis passing except `rubric`. Fixed, and the remedy
for the class (a check that the tolerance covers every artifact field absent
from the recordings) is named and deliberately not built. **D162.**

The first reading of this — that one reader had been taught an exception the
other had not — was **wrong**, and the correction is in D162 rather than
quietly dropped: `surfaces-score.mjs` does not validate anything, it spawns the
probe and renders its JSON, so the tolerance was single-sourced all along.

---

## §9 Part III — the live loop

Preconditions confirmed before starting, all live: desk preflight **exit 0** on
both ships (641 files matching each, clay verified), container up, fakeships up,
write fence present, and — for the first time today — the CLI actually built
from this branch:

```
[PASS] cli-built-from-this-source
    container CLI: /workspace/tlon-apps/packages/tlon-skill/bin/tlon
    sources: 73 files, digest a276f35bfce3 … binary sha256 9cbc22d03571
    every one of the 73 compiled sources matches the build stamp
```

### §9.1 The second aged-board revision — and the metric it broke

`chat/~zod/dash-lihku4fx`, `srf-climbing-sessions`, a cold 6a.5-era board in
`~zod/surface-seed` at revision 2. Nothing in this session produced it.

**Request**, imperative and group-qualified: *"In the Surface seed group's
climbing sessions board, order the climbers by who climbed most recently and
show when each of them last climbed instead of their session count."* Preflight
**ABSENT on all four surfaces** beforehand. Revision moved **2 → 3** in under
two minutes.

| | |
| --- | --- |
| line survival | 67.7% (67 of 99) |
| word survival | **67.3%** (206 of 306) |
| actions | 1 → 1, kept by id |
| surfaceId | unchanged; revision 2 → 3 |
| bytes | 3395 → 3405 |
| classifier verdict | **REGENERATION** (threshold 70%) |

**The classifier is wrong, and that is the result.** The 70% threshold was
calibrated on ADDITIVE requests — D149's scored 100% because nothing had to be
removed. This request was behaviour-CHANGING, and "rank by total, show count"
cannot become "rank by recency, show date" without deleting the accumulator and
both of its display sites. Every changed region maps onto a clause of the
request: `totalFor` → `lastClimbed`, an alphabetical sort → a recency
comparator, two `right=` badges, the card title and empty-state copy, and the
removed trailing `Stat`. The `LOG` helper, the `has` helper, the `register`
shape, the Card scaffolding and the sole action are byte-identical.

So the generalisable claim is not about this app: **word survival conflates how
much text changed with whether the loop regenerated, and it stops
discriminating exactly where the request requires deletion.** D130's evidence
was twelve observations, and it is now known that all of them were of the shape
this metric can measure. That is a limit on the evidence, not a reversal of it
— nothing here suggests the loop regenerates, and every structural marker says
edit. **D164.**

**The app works, and the check is unusually strong:** the SAME witness that
returned ABSENT before the run returns **PRESENT** after it, matched at
`"Last climb"`, with all five negatives still unmatched so it is not matching
by accident.

```
"Climbing sessions … Log a session ~ten2026-08-31 ~zod2026-08-31
 Last climbed ~ten2026-08-31 ~zod2026-08-31"
```

Counts gone, dates in their place, the `2sessions loggedSeptember 2026` footer
removed.

**The pre-registered caveat held**: both climbers tie on `2026-08-31`, so the
ordering half is unobservable in the render. That was written into the record
before the run, not discovered after it; the ordering is verifiable only by
reading the comparator, which is correct.

**One honest debit:** the edit also extracted a `peopleIn` helper the request
did not ask for — about five lines of unrequested refactor.

**The confound, pre-registered, pointed toward regeneration and did not produce
one.** `habit-tracker`, added hours earlier, is a structural twin of this board
and a near drop-in donor. The loop edited the stranger anyway.

### §9.2 The nine-template loop

*Open at the time of writing.*

Two things were settled before it started, and both are recorded in §1 rather
than decided mid-run. `countdown` is carved out of the member-interaction
requirement — it declares `{mode:'none'}` with zero actions, so there is no
interaction to observe, by design and by its own `because` sentence. And a
template that fails the loop is a finding on the template or the pipeline,
reported with evidence, never re-run locally until it passes.

One control ran before the loop and is worth keeping: **publish refuses the
sheet that preview writes.**

```
[rubric-incomplete] 12 of the twelve capture cells have no observation …
  check 7 (answers-the-request) needs a "note" saying what you saw.
  Nothing was uploaded or written.
```

Check 7's machine-stamped reachability citation is present in that same sheet
and does **not** satisfy the check — the human note is still demanded. That is
the division D161 intended: the machine says what was walked, the scorer says
what it means.

---

## §10 Notes for M3/M4

_Open at the time of writing._
