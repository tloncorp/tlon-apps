# Fix-round review — dispositions

Findings from both re-verification passes (Sol: correctness; Claude:
containment), plus the two CI failures from the first run.

Ordering is by disposition, not by source. Each entry says what I propose
and why. **All of these were actioned** across `202c98e7bc..d5c41acdc5` —
B1 → D98 (`202c98e7bc`), A1 (`7fe9c2ce01`), D3/D4 → D100 (`37f0410087`),
D1 → D99 (`8a4b41c852`), C4 (`88eaeededa`), A2 (`0813cea52b`), A3
(`d5c41acdc5`); B2 was taken and folded into D98 rather than given a number
of its own. Read entries below as the record of what was decided, not as a
queue. (This line said "Nothing here is actioned yet" until Session 6a's
orientation caught it — a reader taking it at face value would have redone
landed work.)

Counts: 6 correctness findings, 18 containment findings, 2 CI failures.
Five of the six correctness findings were reproduced with executable
repros; most containment findings were verified against the real linter.

---

## A. Blocking — data loss or red CI

### A1. `foldForMigration(!current)` freezes existing events — **fix now**

`surface-publish.ts:694`. The `!current` branch pairs a new definition's
`initialState`, which covers no posts, with `newestSequenceNum(posts)`. Sol
reproduced actual loss: a valid host event at sequence 1 is neither carried
into the snapshot nor replayed after it.

I filed this as a residual last round. Sol's repro upgrades it — it is
logical data loss while that snapshot stands, and recovery requires knowing
to retract it.

**Proposal:** refuse, matching the repair path. That path already refuses
the identical situation ("reconstructing the state would mean guessing at
it"), and the inconsistency between the two is the finding. Boundary-0 is
the alternative and is worse: it replays every event against a spec they
were not written for.

### A2. Hermes E2E is red, and it is ours — **fix now**

`Could not resolve: "@tloncorp/surface-shell/artifact-strings"` inside the
E2E container, then a 300s adapter timeout. `surface-preview.ts` imports a
gitignored `dist/`, and `Dockerfile.e2e` builds the CLI without building
the shell first.

This is the **fourth location** of the defect step 7 fixed in three places.
It was missed because the build happens in a Dockerfile rather than a
workflow step — the class fix (`check-ci-path-filters.mjs`) guards path
filters, not build prerequisites.

**Proposal:** add the shell build to the E2E container. Then ask whether a
guard exists for "every place that builds the CLI first builds its
dependencies" — four locations found by hand is the signature of a missing
mechanical check.

### A3. OpenClaw CI is red — **it was ours, and it is fixed**

**This entry originally said the breakage was develop's. That was wrong.**

Three TS errors in `packages/openclaw/src/monitor/agent-onboarding.ts`, a
file byte-identical to develop's. The original revert test reverted our
`api`/`shared`/`tlon-skill` sources and got identical errors — but it never
rebuilt `packages/api`, and openclaw resolves `@tloncorp/api` through
`types: ./dist/index.d.ts`, not `src`. So it typechecked against a stale
build containing our changes. The test could not have produced a different
answer, which is the same defect class this whole round is about.

Redone with a rebuild: reverting api makes the errors vanish, restoring ours
brings them back, deterministic both directions.

**Cause:** two generic helpers in `packages/api/src/client/surface/schemas.ts`
returned `ZodEffects<T, any, any>`. Zod declares
`superRefine(): ZodEffects<this, Output, Input>`, and called on an
unresolved generic `T extends z.ZodTypeAny` TypeScript reads Output/Input off
the constraint — which is `ZodType<any, ..., any>`. So `SurfaceEventEntry`
was `any`, and `any` is contagious in a union: `PostBlobDataEntry` became
`any`, every `entry.type === '...'` narrowing downstream became a no-op, and
`TS7006` two packages away was simply the first place `noImplicitAny` could
speak up.

Fixed by two return annotations (`z.ZodEffects<T, z.output<T>, z.input<T>>`),
plus a drift guard at the definition site. It was silently widening our own
types too: `SurfaceSnapshotEntry.state` and `SurfaceSpec.recipe` were both
`any`.

**What survives from the original entry:** `OpenClaw Plugin CI` had not run
successfully on develop since 8/12, so nothing had exercised that workflow
in 19 days. That gap is real and worth its own look — it is why a type error
introduced by us surfaced only when our branch finally ran CI.

---

## B. Needs your ruling — semantics

### B1. §7's refusal criterion is unsafe for malformed ops — **ruling needed**

I ruled that refusals split by _which thing was wrong — the op, or the
state it was applied to_. Sol's counter, verified: a path missing its
leading `/` is a `grammar` refusal (`jsonPointer.ts:96`), so it skips — and
a following `del /today` still applies. **That is the exact archive-then-
clear loss the amendment exists to prevent**, reached through a malformed
op instead of a well-formed one.

The criterion is coherent as a taxonomy and incoherent as a safety rule.
Dependency safety does not track blame: what matters is whether the ops
after the refusal depended on it.

Reachability is currently narrow — `surface event` prevalidates pointer
grammar, so this needs a malformed or out-of-band host writer. But the
reducer is the component that promises total behavior over hostile input,
and every client runs it.

**Options:**

1. **All refusals abort.** Simplest, safest, and makes the criterion
   disappear. Cost: a mostly-correct entry with one typo'd path now loses
   its remaining ops, which is the behaviour skip-and-continue existed to
   avoid.
2. **Abort unless the entry declares its ops independent.** Correct in
   principle, new surface area, and asks authors to reason about something
   they will get wrong.
3. **Leave it, document the gap honestly.** Cheapest; leaves a known
   data-loss path open behind a prevalidation that is not the boundary.

My recommendation is **(1)**. The skip-and-continue benefit is theoretical
— I know of no case where salvaging the rest of a typo'd entry was worth
anything — and the cost is a demonstrated data-loss path. It also collapses
three refusal kinds into one rule, which removes the thing that has now
needed two rulings.

### B2. The `del` asymmetry is worse than "safe" — **ruling needed**

Previously filed as safe-direction. Sol shows it is not: with `/holder` an
array, `del /holder/inner` is a `structure` refusal and **aborts a later
valid `set /after`**; with a scalar holder the same missing delete is a
no-op and `/after` applies. That contradicts §7's own "`del` on a missing
path is a no-op" and suppresses later constructive ops.

**Proposal:** make both a no-op, per §7's stated rule. Folds naturally into
B1 if B1 is taken.

---

## C. Fix now — cheap, high value

### C1. `innerHTML +=` walks past the new rule

Pattern is `(?:inner|outer)HTML\s*=(?!=)`, which requires a bare `=`. Both
`+=` and `||=` pass clean. Accumulating markup in a loop is _the_ reason to
reach for `innerHTML`, so this is likely the most common spelling in
generated code. One-character class of fix.

### C2. `open(` receiver list is narrower than `location`'s

`location` uses `GLOBAL_RECEIVER` (`window|self|globalThis|top|parent|frames|document`);
`open` hardcodes a shorter list, so `frames.open(...)` passes — and
`window.frames === window`. Runtime-mitigated (nav guard replaces
`window.open`, `allow-popups` withheld), but two lists in one function that
disagree will rot.

### C3. `ownerDocument.location` and friends

`el.ownerDocument.location.replace(...)` passes clean. `ownerDocument`,
`defaultView` and `contentWindow` are the receivers most likely in
ref-driven code. Class-1 (enumeration), therefore closable — unlike the
class-2 gaps, which are not.

### C4. Two stale comments in `vite.config.mts`

`:159-163` says the enforcing `<meta>` is "a no-op on the built HTML" and
`:271-278` describes `hostCspDevHeaders` as the Report-Only delivery. The
flag is `true` and that object is `{}`. **This is precisely the defect
class the round existed to eliminate** — a comment asserting the code does
something it no longer does — and it is in the commit that eliminated it.

### C5. `FRAME_SRC_SOURCES`' exhaustiveness claim is false

"Every nested browsing context the web build can create was enumerated" —
two are not: `@sentry/core` and `@sentry-internal/browser-utils` each
create a hidden iframe to read native implementations. Both are src-less so
`frame-src` never evaluates them, and the allowlist is still complete for
framable origins. **But Sentry ships enabled in production** (`VITE_SENTRY_DSN`
is passed from secrets in three deploy workflows), so the claim is wrong as
written.

Also: a parallel sweep reported Sentry as disabled. That is incorrect and
should not propagate.

**Proposal:** add the two rows, plus a sentence on why src-less is exempt —
or narrow the claim to "every context that fetches a URL."

---

## D. Fix now — the guards that cannot fail

I predicted one more vacuous guard in the fix-round summary. There were
**four**, three of them new.

### D1. `surface create`'s negative control tests the wrong thing

It uses a _different_ title (`"Someone else's channel"`), so it validates
the implementation's title predicate rather than the requirement — that the
create produced new state. Sol raced a same-title collision and got
`ok:true, reused:false` on a channel this command did not make.

The title is caller-chosen data, not host-stamped evidence. **The class
claim I wrote for step 5 is false for create.** The post writer's
host-stamped-head fix is sound; create needs the equivalent.

### D2. The "two batches" convergence test folds once

`surfaceReducer.test.ts:876` slices and reorders, then calls
`reduceSurface` **once**. The reducer sorts internally, so it duplicates
the preceding shuffle property. No watermark, prefix state or abort count
crosses a batch boundary, so a mutation breaking incremental carry cannot
fail it. No product failure established — consumers recompute from the full
set — so this is an evidence defect, not a runtime one.

### D3. Three activation paths report clean while pressing nothing

- `el.onclick = fn` — never reaches `addEventListener`, so the recorder
  never sees it, and it is not in `otherEvents` either.
- Delegation onto `document` — recorded, then dropped by a
  `root.contains(el)` filter with no accounting.
- A binding on the shell root — survives `contains`, then `run.click`
  (`root.querySelector`) never matches the root, returns **`false`**, and
  the return value is discarded.

Root cause: shortfalls are reported per declared **action**, not per
**control**, so a missed control is invisible whenever some other control
invoked the actions. **My commit message claimed "what it cannot do is
reported, never passed." That is false.**

**Proposal:** count bindings the filter dropped and controls where `click`
returned false; report both as shortfalls. Turns all three silent paths
into skips without changing what the gate can reach.

### D4. Chart oracle evadable off the synchronous stack

A handler that reassigns `chart.options` inside
`Promise.resolve().then(...)` passes clean — every `inspect()` runs
synchronously, so microtasks flush after the gate returns and timers never
run. Moving to the live instance closed reassign-on-press, not
reassign-after-the-turn.

---

## E. Documented, not fixed

### E1. Exact retry reports success over a migration-pending channel

Verified. The byte-identical early return (`surface-publish.ts:348`)
precedes any migration-health check, so an automated retry loop gets
success and stops while the channel is unusable.

I called this "transport-caused only." Sol's correction stands: **any**
crash or post failure after the non-transactional description write creates
it. `surface snapshot` repairs it, so it is not permanent loss.

**Proposal:** have the no-op path post the missing snapshot when
`preserveState` is set and no current-revision snapshot exists. Small, but
it is a semantics change on a path we just touched — worth doing
deliberately rather than as a tail.

### E2. `abortedEventCount` never reaches a host, and snapshots finalize it

Worse than the reporting gap I recorded. `surface state` omits the count
(`surface-records.ts:423`) **and** the snapshot builder never checks it
(`:659`) — so a host's failed entry gets checkpointed as successful history
and subsequent folds start above it.

**Proposal:** surface the count, and refuse to snapshot over a fold
containing aborts unless explicitly forced.

### E3. The listener's residual is understated by 4 bytes per event

`blockedUriHash` is 32 attacker-chosen bits per event. The docstring's
residual names only the host label. Trivial in practice; the docstring is
otherwise scrupulous, so it should say so.

### E4. The bound is a detection-evasion surface

A bundle emitting five junk violations makes every later one `dropped`.
Enforcement is unaffected — blocking never depended on telemetry — but "the
one signal that survives enforcement" can be spent by the party it watches.

### E5. The signal is gated on analytics opt-in

`captureAnalyticsEvent` no-ops for opted-out users, so for them nothing
reaches an operator. `hostCsp.ts` calls this "THE ONE SIGNAL THAT SURVIVES
ENFORCEMENT" without the qualifier.

### E6. Report-Only and enforcing are mutually exclusive by construction

Flipping the flag back to get Report-Only also removes the enforcing
`<meta>`, so a candidate allowlist widening cannot be validated under
Report-Only while the current policy still enforces. Cheap with one
directive and two sources; not cheap if the policy grows.

### E7. `ManageAccountScreen` has no test of the real response

Its only coverage aborts the route, proving the preflight admits the origin
but never exercising the response. If `https://tlon.network/account` ever
redirects to a subdomain, `frame-src` blocks it, account management breaks
silently, and the only signal is the bounded listener.

---

## F. Won't fix — with reasons

- **Class-2 lint gaps** (`el["innerHTML"]`, `Object.assign(el, {...})`,
  computed member access, `Reflect.get`). Property access is not a lexical
  property of source; closing these requires solving data flow. The bracket
  forms are cheap and could go in C, but the class stays open by
  construction and the docs now say so.
- **`<form ...${{action}}>`.** `allow-forms` is withheld, so it is not
  live. Worth noting the rendered-DOM element list is a second enumeration
  that has drifted from the lexical one.
- **Anchor markup inside a string literal false-positives.** Real, and the
  same "commonest firing is wrong" failure the round set out to fix — but
  fixing it means distinguishing display strings from markup, which the
  scanner cannot do. Better addressed by narrowing what `MARKUP` spans
  cover, if at all.

---

## The pattern worth naming

Three of the four vacuous guards were **written this round, by the fix
round, as the evidence that the fixes worked**. The round's own rule was
"no control without a demonstration that it can fail" — and the demonstrations
were themselves not checked for whether they could fail.

The two reviews caught what self-review did not. That is the argument for
keeping the split, not just for classifier reasons.
