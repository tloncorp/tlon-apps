# Surface Channels — verification audit, 2026-09-02

Six read-only investigations run at the end of session 6c, after a session that
verified a great deal and *looked* at almost none of it. Each is a separate file
here; this is the index and the ranked list.

Nothing in this audit changed source. The docs audit (§6 below) is the one
exception: it corrected four factual errors in the skill documentation, which
is reported rather than hidden.

| # | investigation | headline |
| --- | --- | --- |
| [01](01-seed-fixtures.md) | seed adversarial fixtures | **7 of 9 intact**; the 2 exceptions were errors in my brief, not vacuous guards |
| [02](02-client-render-path.md) | client render path | **works**, verified live — but the two halves are each tested against a fake of the other, and one real bug found |
| [03](03-reducer.md) | reducer | **security core sound and well-tested**; three assumed-not-checked gaps |
| [04](04-sandbox-egress.md) | sandbox egress | **the egress leak test cannot fail** |
| [05](05-actor-substitution.md) | `$actor` substitution | the two readers agree on the token; the gate's **proxy** for ownership is what fails |
| §6 | skill documentation | 4 factual errors, 2 of them capable of real damage |

---

## P0 — a security guard that cannot fail

**1. The egress leak test cannot fail.** All five network probes — fetch, XHR,
WebSocket, image beacon, `sendBeacon` — target `https://beacon.invalid/`.
`.invalid` is RFC-6761 reserved and can never resolve, so every "blocked"
verdict is a `catch` branch a DNS failure takes identically, and the
network-level backstop is satisfied by DNS failure too. **If the sandbox CSP
stopped working tomorrow this test would still pass.**

What makes it worse: `navigation.spec.ts` names `sandbox.spec.ts` *by name*, in
a comment, as the anti-pattern it exists to avoid, and a recorded decision makes
the real-attacker-server method the standard for future leak tests. The correct
harness is ~400 lines away in the same suite and was never back-ported.

This is the fifth guard-that-cannot-fail found in this session, and the only one
protecting execution of untrusted model-generated JavaScript.

**2. A known-live escape vector has no probe.** A recorded finding says a bundle
calling `window.navigation.navigate()` **reached the attacker origin in
Chromium** while passing the gate; it was deferred as "a follow-up for that
suite." The probe list has five entries and none touches the Navigation API. The
claim "self-navigation is blocked" is licensed for five spellings, not as a class.

**3. The posture suite runs nowhere in CI.** Per-PR protection is string pins,
not behaviour. Native (iOS/Android) has no mechanism and no test at all, so
M0's "leak test on all three platforms" is unmet for two of three — visible only
inside a source comment.

**The posture itself is currently sound.** The full matrix ran 53/53: with the
CSP removed the original escape reproduces and hits the attacker server; under
the shipped policy all five navigation vectors are blocked at preflight with
zero hits. What is broken is the thing that would notice if that changed.

## P1 — checks shipped the same day, already bypassable

**4. The no-op-control exemption is defeated by MOVING the token, not removing
it — and there is a one-line fix.** The two readers agree almost exactly on what
the token is; the gate's value test is a faithful transliteration of the
reducer's. The hole is one level up: the gate treats *"the reducer will
substitute somewhere in this op"* as a proxy for *"this op writes only the
presser's own data"*. Substitution is a property of where the AUTHOR PUT the
token; ownership is a property of where the op WRITES, which the gate never
looks at. So the "EVERY op, not merely one" defence — named as the whole
discriminator — falls to relocation.

Three bypasses, verified through the real `analyzeReachability` rather than the
predicate alone, on an identical one-node self-loop graph:

```
C   set /tasks/theme/status "doing" + set /claims/$actor "theme"   → REPORTED
S1  set /tasks/theme {"status":"doing","claimedBy":"$actor"}       → silent
S2  set /tasks/theme/status {"v":"doing","by":"$actor"} + …        → silent
S3  set /config/mode ["fixed","$actor"]                            → silent
```

All three pass `spec-schema`, `pointer-hygiene`, `action-idempotency` and every
other rule.

**The fix is one line, and it is free.** Across all nine shipped templates,
`$actor`-in-a-value appears in exactly one shape: the whole value is the bare
string `"$actor"`. Never nested in an object or array. Narrowing the value arm
to "the value IS exactly `"$actor"`" closes S1, S2 and S3 at zero cost to the
templates. The recursive arms are exercised by one synthetic test and are
otherwise pure attack surface.

**And the finding text publishes its own bypass.** The `no-op-control` message
ends *"an action whose every op writes `$actor` is exempt"*, and preview prints
`finding.message` verbatim into the defect list the generating model reads and
repairs against. The exemption is self-granted AND self-documented to the party
that benefits.

**No differential test exists.** Nothing anywhere imports both the gate's
predicate and the reducer's `applyOp`. The two readers were written days apart
in different packages and are held together only by sharing the placeholder
*string* — not its semantics.

**A limit on the control itself:** the shipped `kanban` template — the app
family this rule exists for — is the one template whose walk does not close, so
the pass emits no findings for it at all and the sheet reads "not measured". The
rule is proven on a 3-card, 193-state fixture.

**5. A permanently inert action passes the entire gate clean.** An action whose
ops use partial-segment `$actor` (`/votes/$actor-choice`) is refused by the
reducer at fold time, and: pointer hygiene accepts it (legal pointer), the
idempotency fold accepts it (a refused fold is trivially idempotent, and the
lint never reads which folds aborted), and no-op-control excludes it because
every edge aborted. A dead action ships green.

## P1 — silent data and consistency failures

**6. The `--preserve-state` fix is publish-only.** D167's guard lives in
`surface publish`; the reducer still replaces `initialState` wholesale. Any
other writer — Hermes, a hand-edited description, the client-executed publish
the plan contemplates for v1 — reintroduces the bug at full strength. The
semantic is written down only in a test comment and D167, never in the plan.

**7. Duplicate sequence numbers break convergence, and the property test's
generator excludes the failing case.** Two posts sharing a sequence number tie
completely in the sort, so the fold becomes input-order-dependent: `A,B` yields
one state, `B,A` another. Every determinism test shuffles posts with *distinct*
sequence numbers.

**8. An inflated `upToSequenceNum` permanently bricks a channel.** A host
snapshot claiming `upTo: 1_000_000` wins selection forever and freezes the board
at `foldedEventCount: 0`. The realistic trigger is not malice — it is a bot
writing a millisecond timestamp into that field. The plan's comment reads as a
checked invariant; it is a writer obligation.

## P2 — silent client failure

**9. A bundle that throws before it registers leaves a permanently blank
board** — no error state, no message, no telemetry. A throw *inside* render is
handled correctly and shows the error card; the unhandled window is
module-evaluation time, which is exactly where a model-generated bundle with a
bad line fails. An `onShellError` channel is plumbed through the whole session
layer, with a comment explaining its text is left untruncated because it feeds
"the host component's own error UI". That UI does not exist and nothing passes
the callback.

**10. The two halves of the render path are each tested against a fake of the
other.** The React host is tested against a stub shell (the shell's JS mocked to
`'void 0;'`, the ready handshake hand-dispatched); the real shell is tested
against a hand-rolled iframe that does no schema validation and no revision
check. Nothing composes them, and the browser-side suite is not in CI.

**11. `useSurfaceHydration` has no test file**, and under the app's global
`staleTime: Infinity` its dependency predicate is the only thing that ever
refreshes a board.

## P2 — documentation and parity

**12. A parity hazard.** The plan states `$actor` path substitution emits the
RFC-6901-escaped form (`~0zod`). The code substitutes into an already-unescaped
segment list, so the real key is plain `~zod`. The behaviour is right and the
description is wrong — an implementer following the plan literally diverges on
six of nine templates. Relevant because a second, Python implementation exists.

**13. Two gate findings are invisible to the bot that must repair against
them.** `count-agreement` (gate rule 17, severity error) and `no-op-control`
(reachability finding) appear in no document. `initial-state-changed` is
described in prose but missing from the error-code table the docs tell the bot
to branch on.

**14. The doc test's own blind spots are where both dangerous errors lived.** It
checks subcommand names and the rule *count*; it explicitly does not check
flags, and does not scan `PRIMITIVES.md` or `RUBRIC.md` at all. Unpinned and
ranked: every number in the caps table, every flag in all four docs, the 22
error codes and their author/environment class, the rubric contract constants,
and every primitive prop.

## P3 — housekeeping

**15.** Two seed fixtures can no longer pass the gate they predate —
`surface-revision` fails `jargon` on the word "revision", which its purpose
requires it to display, and `surface-chart` fails `undeclared-action` on a
computed invoke. Channel behaviour is unaffected because the seed writes specs
directly rather than through `surface publish`.

**16.** `surface-channels-f1-navigation-escape.md` is a 309-byte truncated stub
ending mid-word, untracked, with no recoverable history.

**17.** `chat/~zod/dash-ltjbt690` is an orphan — no spec, no posts, in no
document. A `create` that landed when its `publish` did not.

**18.** `surface-transitions.ts` contains two literal NUL bytes (intentional
signature separators). `file(1)` calls it `data`, so plain `grep` — including
`grep -r` — **silently skips it with zero hits and no message**. Three separate
investigations lost time to this. Use `grep -a`. The same is true of
`dev/surfaces-score.mjs`.

**19.** A host op can write a literal `$actor` object KEY, contradicting
`jsonPointer.ts`'s own doc comment. Nothing ever re-scans state, so it stays
literal forever — noted for the record rather than as a live risk.

---

## §6 The documentation audit

Four factual errors, corrected:

- **`surface publish` does NOT own `bundle.*`** — `bundle.shellVersion` is the
  author's field and picks the shell. A bot revising via `surface show` would
  have dropped it. The most dangerous of the four.
- **Snapshot state cap documented at 64 KB; it is 128 KB.** The source records
  that change as having been made to close a band of states legal to hold and
  impossible to snapshot — so the doc was still describing the bug.
- **"One computed invoke turns the check off for the whole bundle"** — false,
  disproved by a live lint run. It is per-call.
- "Two templates are installed today" → nine.

Everything else verified, including all 22 error codes and their classes, every
cap but one, every primitive prop, and the whole rubric contract.

---

## What was deliberately not determined

- **Live updating** — the other half of the milestone's exit criterion. Observing
  it requires a post landing while a board is open, and every route to that is a
  channel write, which the investigations were forbidden. The wiring was traced
  and is correct; that is a code reading, not an observation.
- **Four client-side fixture states** (oversized's retry, invalid's fallback,
  future's upgrade prompt, migration's spinner). Inputs and the shared code path
  verified; the pixels were not. ~30 minutes in a browser closes all four.
- **Whether the `window.top` and `localStorage` probes share the `.invalid`
  confound.** Flagged as suspected rather than asserted: the test host sits on
  `about:blank`, so adding `allow-same-origin` might go undetected in test while
  being catastrophic in production. A ten-minute experiment settles it.

## A correction to my own brief

I listed nine seed fixtures as negative controls. Two were wrong:
`dash-ltjbt690` is an orphan channel that appears in no document, and
`surface-chart` is a *positive* control (and healthy). I also omitted
`surface-poll`, which is the documented ninth and is fine. Six genuine negative
controls plus the migration and revision fixtures are all intact — including,
notably, the escape target at `:4322/stolen` still serving `NAVIGATION
SUCCEEDED`, since a dead port there would itself have been the textbook vacuous
guard.
