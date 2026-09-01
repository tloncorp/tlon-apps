# Surface Channels v0 — Session 6b

Branch `patrick/mini-app-mvp`, PR #6380 (draft). CI was green at `cfc03257ae`
(9/9 checks) before this session's work; eight commits are pushed on top,
head `691c73fbb5`. A parked-workstream docs commit from another session
(`a030b159da`) landed on the branch mid-run and this work stacks on it.

Verification at the pushed head: typecheck clean across all packages;
`tlon-skill` 1,569 tests with only the four known local `media-guard` bun
artifacts failing; `api` 1,121/1,121; `surface-shell` 101/101; `openclaw` dev
suite 79/79; nine of nine templates gate-clean and machine-pass clean through
real Chromium; formatting clean repo-wide.

Decisions **D130–D149** appended.

Split-review-ready: §1 is the verdict entry, §2 the five conditions, §3 the
preview and time work, §4 the templates (and §4.1, what was NOT done there),
§5 fork, §6 the eval harness, §7 the one live measurement, §8 what this session
did not close. **The one thing worth reading if you read nothing
else is §2.5**, where a guard written in this session was caught being vacuous
within an hour, by running it.

---

## 1. The verdict, recorded

**D130.** The bundle format earns its keep. Twelve post-read-back revision
observations, zero regenerations, and the kanban structural case. M2's format
gate is satisfied and the template list is confirmed at nine.

Two qualifications were recorded **with** the verdict rather than after it,
because they are the parts a later reader would otherwise have to rediscover:
only seven of the twelve observations were forced, and four of the verdict
run's six edits were on apps the same loop had generated minutes earlier. Part
I.5's aged-board revisions are the free confirmation on that residual.

---

## 2. The five conditions

### 2.1 The write fence (D131)

A surface write is now bound to a target, not only to a sentence. A scope file
named by `TLON_SURFACE_SCOPE_FILE` carries a bound `channel`, a `preState`
identity that channel must still carry, and the `groups` writes may touch at
all; `publish`, `event`, `snapshot` and `create` all refuse outside it.

Enforced at `resolveSurfaceChannel` — the only place in the surface commands
that turns a channel id into a group id, and therefore the only place a group
fence applies without every command remembering to. Its new `access` argument
is **required**: reads must stay unfenced, and an intent defaulting to `read`
would let a future write command slip past by saying nothing. Forgetting to
decide is now a type error.

Four negative controls, all run: the wrong-board write reproduced unfenced;
refused once bound, naming both channels, with nothing written; an undeclared
group refused; a pre-state moved between the bound and the publish refused,
naming both identities, leaving the existing revision untouched. Mutating both
call sites to no-ops failed exactly those four tests and no others.

**Verified live**, not only against the fake ship: bound to one board, a
publish aimed at a board in another group refused naming both, while reads
under the same scope continued to work.

**Honest about the split.** The channel binding has a demonstrated failure
behind it. The pre-state binding is precautionary — it prevents a concurrent
modification nobody has observed — and it will occasionally refuse a legitimate
republish inside one bound turn. That trade is deliberate and the refusal names
both readings, but it is the accretion the decision brief predicted, and it is
labelled as such rather than presented as equally earned.

### 2.2 The structural witnesses, re-read independently (D132)

A fresh agent that had not authored the witness patterns went back to the
verdict run's pre-state bundles and read them as a reviewer.

**The record holds.** Both audited requests were genuinely unsatisfied, by
several independent readings each, with byte-level chain of custody from the
captured pre-state artifact to the bundle the preflight fetched to the sentence
that went down the wire.

**The instrument had a hole.** The bundle-source check searched with the prose
pattern set only, so for `rev-poll-cant-make-it` it could not have fired even
on the app that demonstrably had the behaviour — while the evidence sheet said
"the bundle source does not mention it" as though it had looked. Fixed by
searching the union of both sets, which is safe without a further self-test
because a source hit yields ABSTAIN and never PRESENT. Reverting the union
fails exactly the two new tests.

Three further limits were found and **recorded rather than fixed**, each
because closing it would be new machinery and none of them bit this corpus:
state is never pattern-matched, the twelve render cells are two state
configurations rather than twelve, and a parameterised action would evade the
action-map check (inapplicable in v0, live the day input-carrying actions
land).

### 2.3 The display-only hatch costs evidence (D133)

`memberInteraction` is now `{ mode: 'none', because: string }`. The doctrine was
reordered so the constraint is met before any copyable snippet, the schema
rejects the bare string the field used to be, and a spec carrying the marker
draws a conditional eighth rubric check scored against the request.

The control the condition asked for: the verdict run's inert-but-declared
expense spec, in the new marker shape, is refused with `rubric-incomplete`
naming `display-only-was-asked-for`; it publishes once the check is scored; and
an app making no such claim is asked for nothing extra.

**What it does not do**, said plainly because the last rule of this shape was
believed to do more than it did: `because` is not machine-checkable and is not
trying to be. It raises the price of the wrong choice from nothing to a
paragraph and puts the claim where a human reading the sheet can see it. A
determined loop can still write a plausible false sentence in two places
instead of one. Guarding _that_ would be the next turn of the same crank, and
this session declined to take it.

### 2.4 The desk preflight (D134)

Assembles the branch's desk the way `deploy.sh` and rube do and compares it
file by file against each ship's mounted `%groups`, with exactly two documented
exclusions — the git stamp (checked for ancestry instead) and the released
frontend glob (never fetched in this workflow).

A mount comparison cannot see "rsynced but never committed", and there is no
way to read a clay file back over eyre, so a per-machine gitignored ledger
carries the pike hash verified against a content digest. A commit nobody
recorded shows as a moved pike hash; a sync nobody committed shows as a digest
with no ledger entry.

Demonstrated failing against a decoy pier missing exactly the mark that caused
the original staleness, and against both ledger divergences. The current
fakeships pass on all 641 files.

### 2.5 The guard that was vacuous when written (D135)

This is the finding worth carrying out of the session.

D131's container assertion first read `TLON_SURFACE_SCOPE_FILE` out of the
running process, found it set after the recreate, and passed — while the CLI
the bot actually invokes was a compiled binary built **before the fence
existed**, ignoring the variable entirely. The assertion was confirming that an
environment variable pointed at a file the binary never read. That is species 4
of the taxonomy, claims-a-mechanism-never-exercised, reproduced within an hour
of writing the mechanism it was guarding.

It now exercises the fence with three credential-free probes, the third of
which is the control: with no scope named, the CLI must fall through to the
ordinary failure. Without that arm the other two would pass against a CLI that
failed on everything. The negative control is an August binary that predates
the `surface` command group entirely: three identical non-refusals, assertion
fails, which is the required outcome.

**The general lesson.** The guards this project keeps writing are guards about
configuration, because configuration is what is easy to observe. The
configuration was correct and the behaviour was absent, simultaneously, and
only one of those was visible to the check.

---

## 3. Preview, conformance, and host-supplied time

`--host-ops` folds real host events into the populated capture, with a
per-entry `before`/`after` because `after`-only archives the state the invokes
just produced. `--state <file>` renders a template's own `state.json` — the
file every template's NOTES call "what CI renders", which until now the CLI had
no way to draw. Host-supplied `now` is an explicit render input with three
fixed injectors (preview, the gate, the preflight witness).

**Two of the prompt's requirements could not be met literally, and both
substitutions are better than what was asked for** (D143). "Shell-minor" has no
representation — `SHELL_VERSION` is a single major and bumping it breaks every
spec's pin — so it stays 1 with the compatibility argument written down. And
"the shell re-renders on an interval" cannot be true and deterministic at once,
because a shell-owned interval must read a clock. The interval is the host's,
gated on the declared flag; the shell repaints only when handed a `now`.

**The conformance assertion D69 asked for would have been vacuous** (D142).
Preview has no second fold — it imports the client reducer and calls it — so
"both implementations, asserted equal" asserts a function equals itself, green
forever including on the day someone forks it. Shipped instead: a source-pin on
the import, a demonstration that preview's migration gate is the reducer's own,
and D69's divergence asserted rather than described.

**The determinism control's first version was wrong, and its own negative
control caught it** (D144) — four renders in one process, where a module-level
constant is evaluated once, so pinning it to the wall clock still passed. Now
one subprocess per run: injected gives twelve byte-identical cells across runs
1.1s apart, ambient gives twelve that differ, and both mutations fail.

**`Date` is enforced for the first time** (D145). Rule 16's lexical leg is what
makes §3's long-standing sentence true; the behavioural leg catches what the
lexical one cannot, and the fixture set proves both are needed —
`Date.now() > 0 ? 'yes' : 'no'` is stable across a day, so the behavioural leg
is blind to it by construction. §3 is reordered to D133's rule and now states
its own limits where the hatch is offered.

And `gate-harness-unavailable`: the gate renders a known-good canary first, and
a harness failure is now an `environment` refusal saying *"Your files are not
implicated — do not rewrite the app"* rather than a `smoke-render` violation
against correct code.

---

## 4. The templates

Nine, from two. `rsvp`, `potluck`, `expense-split`, `leaderboard`, `kanban`
joined `poll` and `workout-tracker`, and `habit-tracker` and `countdown`
landed once §3 gave them the time input they needed.

Every one is gate-clean at zero violations, zero warnings, zero skips, with the
twelve-cell matrix looked at and scored.

**`workout-tracker` was shipping a defect in all twelve cells** — two buttons
0px apart, under the tap-target minimum — and it is the template whose idiom a
new author copies first. Three separate agents found it independently, each by
running preview by hand. Nothing in CI could see it (D147). The machine pass
now runs over every shipped template in CI, one subprocess per template
(measured: seven in one process wedge Chromium; that same template alone
finishes in ten seconds), and removing the fix fails the new leg naming
`tap-targets`.

**The kanban case is §4's real finding and it is in D140**, above.

**A display-only template broke two suites that had never seen one** (D148),
and both breakages were the same assumption. `surface-templates.test.ts`
required every `state.json` to name a ship; the shell-side suite required every
template to render buttons and a member crew. Both were written when every
template had member actions; both are false of a countdown by design. Waived in
each, granted ONLY by the `memberInteraction` declaration — an app that merely
happens to have no actions still has to show buttons and people, because that
is also exactly what a forgotten action looks like.

Where the general assertion is waived the shell-side suite asserts a STRONGER
one rather than skipping: zero controls, zero declared actions, zero invokes,
and an identical screen to a read-only viewer, because a display-only app that
fired an invoke would be lying about itself.

**Worth recording how that was found.** Both template authors reported green
and both were right about the suite they ran; the shell-side suite was last run
before `countdown` existed. It surfaced only in a full cross-package
verification, after the commits were already made.

Writing the last two also closed four pieces of doctrine debt (D148):
`surface templates show` was printing `actions: (none declared)` for a
display-only app while withholding the `because` sentence — showing an
inspecting bot exactly the ambiguity D133's marker exists to remove, at the
moment it decides what to copy; `PARADIGM.md` §3 over-claimed reproducibility
(cell-to-cell byte equality within one run flakes about one cell in sixty, and
the claim now says compare a cell against itself across runs, which is what
D144's control does); §2's host-is-the-clock section assumed a schedule
throughout, when lazy rollover is the shape a bot can actually deliver; and §5's
float ban appeared to forbid what `Progress` requires.

### 4.1 What was NOT done here, stated plainly

The templates were authored, gated, previewed and scored **locally**. The live
loop Part III specifies — create → lint → preview → publish → interact from a
second ship → one revise cycle, on the fakeships with the write fence
active — **was not run for the nine templates.** The infrastructure for it is
in place and verified (container recreated and fenced, CLI rebuilt from source,
desk preflight passing on all 641 files), but the runs themselves have not
happened, so no template in this session has been published to a channel.

§7 is the one live measurement that did run, and it is worth reading before
§8: it answers the residual D130 left open.

---

## 5. `surface fork`

Built, 35 tests, ten verified negative controls. §9 was wrong in three places
that only building it exposed (D137): `--into` names a channel rather than a
group — which is what lets the write fence apply to fork exactly as it applies
to publish; `--regenerate` cannot "run the full generation loop" from a CLI,
because the loop is the bot's; and "re-lints the copied bundle" understated a
re-gate that necessarily takes two runs, since a fresh sheet must be bound to
an id fork has not minted yet.

**The fourth-bite test would have passed under the defect it was written to
predict** (D138). Both markers it names are declared on the schema, so neither
can tell a raw derivation from a validated one — only an undeclared key can.
The fixture carries one, and there is now a test pinning that the fulcrum is
the undeclared key rather than the markers. Re-verified after `provenance` was
declared later the same day, which removed another candidate discriminator: the
mutation still fails, and still on that assertion.

`provenance` is now declared on the schema (D139), the third field for the
D67/D72 reason — every fork was writing an undeclared key.

---

## 6. The eval harness

33 requests: 27 in scope, three per template across all nine, plus six
deliberately out of scope, with 6a's eight carried verbatim and pinned by a
test so a tidy-up cannot break comparability.

**The out-of-scope six are paired, not filler** (D141). `oos-poll-lookup` and
`poll-movie-night` carry the same trigger word with opposite correct answers,
so the obvious repair for 6a's routing misses — making the word magnetic —
moves the two numbers in opposite directions instead of scoring as a clean win.

Nine axes, scored by **re-deriving the gate and the rubric from artifact bytes**
rather than trusting the run's own report; a disagreement between the two is a
`contradiction`, ranked above `fail`. `unscored` is never `pass` and there is
deliberately no headline pass rate. Cap kills are first-class, per-phase timing
comes from the transcript's own timestamps, and the scoreboard reports medians
because one 300s kill drags a mean across 33 requests.

**The negative control runs in both directions**, and the second direction is
what makes it a control: six breakages each shaped to look like a success
against a clean fixture beside it, because "the broken run scored broken" is
satisfied by a scorer that scores everything broken.

The full corpus run is the M2 exit measurement and is not this session's.

---

## 7. The aged-board revision (Part I.5)

The one live measurement in this session, and it answers the residual D130
left open (D149).

`chat/~zod/dash-ezw1rkiq` — a 6a.5-era chess leaderboard at revision 3 for
weeks, which nothing in this session's context produced. Asked, imperatively
and group-qualified, to add each player's current win streak. Preflight ABSENT
on all four surfaces, both witness sets passing their two-sided self-test; the
negative that mattered was `"Running total: 1 points · 1 game"`, which contains
*Running*, so a witness reaching for a bare `run` would have refused a request
the board genuinely does not satisfy.

**The confound was recorded in the request record and committed before the
result was known**, because stating it afterwards would be worth much less:
this session added a `leaderboard` TEMPLATE hours earlier and the bot can read
it, so regeneration was the CHEAP path while the board was the stranger. That
inverts the verdict run's condition, where four of six edits were on apps the
loop had generated minutes before from templates it had just read.

**A purely additive local edit: 100% line survival and 100% word survival** —
all 64 original lines and all 326 original words kept, four lines added, all
three action ids kept, same surfaceId, revision 3 → 4, 180s to published.

The diff adds an accumulator inside the existing closure rather than a second
pass, and computes the trailing run in one render line. **It declared no new
action** — correct for a derived value, and what the witness's deliberately
hypothetical action positive anticipated.

**And the app works**, checked because D140 is the standing reason not to stop
at the diff: `~zod` (one win) paints `Current win streak: 1`, `~ten` (one draw)
paints `0`; no shell errors, no unprobed cells, no machine defects, gate clean.

**The fence's permit path is now live**, not only a unit test — the binding
flowed from the preflight into the container's scope file and the bot published
to the bound channel and nowhere else.

**What it is not:** n=1, and an additive request. The verdict run's one no-op
and the kanban's poor design choice both came from harder requests. What it
settles is narrow and real — the loop's edit behaviour is not an artefact of
revising apps it had just written.

---

## 8. Notes for what remains of M2

**The corpus run**, in the bot harness, outside a build session.
`surfaces-eval-run.sh` makes it a loop rather than 33 improvisations, and its
scoreboard replaces the recorded baseline.

**Provisioning** — the moon→storage grant and the admin role — unchanged and
still the hard dependency.

**The transition gap is the first thing I would build next** (D140). Rubric
check 7 has now passed three defects, and all three are about what happens when
you press something while the check is scored from a still image. The preview
matrix renders states and never transitions. Giving it a transition graph —
press each control, capture the result, report what no sequence reaches — hands
the rubric something it currently cannot see, which is a better use of a
session than another rule about the same picture.

**Left open, named rather than implied:** the cwd-dependent gate failure's
CAUSE (the class is fixed, the cause was not reproducible after a dist
rebuild); fork's rubric binding, which a spec-only source revision still
satisfies; the skip rule and the template test disagreeing about
state-conditional controls (D136.6); and `PRIMITIVES.md` having no secondary
text slot inside a `ListRow`, which is why several templates render two
equal-weight lines per row.
