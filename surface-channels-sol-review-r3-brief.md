# Sol review brief — the authoring layer

You reviewed this branch twice before (surface channels v0 for Tlon
Messenger — bot-authored dashboard channels rendering untrusted app
bundles in a sandbox). Those two rounds were a security review of the
**sandbox and renderer**, and they closed with a 2-round budget and the
verdict "not yet safe to build the authoring layer on."

**This is not round 3 of that review.** It is a first review of a
different artifact: the authoring layer itself, which has since been
built. Do not treat the earlier verdict as a prior you must confirm or
overturn — treat the code in front of you as new.

Review target:
`git diff 73c26140f6..HEAD -- ':(exclude)pnpm-lock.yaml'`
(95 files, +18,691/−238, 26 commits).

Roughly 3,100 of those insertions are markdown (plan, decisions, skill
doctrine, session report). Those documents are **in scope** — the skill
documents are executable in the sense that matters here, since a bot's
behavior is determined by them. But weight your time toward the code.

---

## What the thing is

A "surface channel" is an ordinary `%chat` channel whose description
carries a `surfaceSpec` (a hash-pinned bundle reference, declared actions,
and initial state). Posts are the event log; the client folds them into
state with a pure reducer; the app runs in a sandboxed webview against a
client-shipped shell. **Zero new Hoon.**

The layer under review is what lets a bot author one:

- `packages/tlon-skill/scripts/commands/surface*.ts` — a CLI command group
  (`create`, `templates`, `lint`, `publish`, `event`, `state`, `snapshot`,
  `preview`).
- `packages/tlon-skill/scripts/surface-lint.ts` — the publish gate, 14
  rules. Review its correctness as a validator: schema handling, rule
  ordering, reporting, and the skipped-vs-passed distinction.
- `packages/tlon-skill/scripts/surface-preview.ts` — renders a bundle
  through the real shell in headless chromium and screenshots it.
- `packages/tlon-skill/skills/surfaces/` — `SKILL.md`, `PARADIGM.md`,
  `PRIMITIVES.md`, `RUBRIC.md`, and two templates.
- `packages/surface-shell/` — the shell (preact + htm + Chart.js + sigil),
  its primitives, and the sandbox assembler.

## Read first

1. `surface-channels-plan.md` §4.3 (action semantics), §5 (sandbox
   posture), §7 (op language), §9 (the tlon-skill workstream — commands,
   gate, preview, fork). This is the design document and it is canonical.
2. `DECISIONS.md` D49–D74. **Treat these as claims, not evidence.** They
   were written by the engineer who orchestrated the work. Several record
   measurements ("verified", "measured", "mutation-checked") — check that
   the test or probe actually measures what the prose says. At least one
   earlier decision in this file was found to overstate its own
   measurement, and the correction is recorded inline; assume there are
   others.
3. `surface-channels-session5-report.md` — same standing: a claim.
4. `packages/tlon-skill/skills/surfaces/PARADIGM.md` — the doctrine a bot
   follows. Read it critically: what does it fail to forbid?

## Priority questions

1. **Out of scope for you.** The sandbox posture and the lint's
   navigation rules are being reviewed separately. Skip them. Do not
   analyse the sandbox document, the nav guard, or rule 5. If a question
   below leads you there, answer the part that does not.

2. **Are the gate's behavioral checks actually behavioral?**
   Two rules are specified as behavioral rather than lexical, because the
   lexical versions were dodged in practice:
   - the **canvas/chart check** asserts, after a real smoke render, that
     no `<canvas>` carries `width`/`height` attributes and every live
     chart reports `responsive: true`;
   - the **fold idempotency smoke** folds each declared action twice and
     diffs the state, failing non-idempotent member actions unless the
     action is marked `duplicatesTolerated`.

   Verify both do what they claim against the real shell and the real
   reducer. Then: what does a rule that _cannot run_ do? The design says
   a rule that cannot be evaluated must be **skipped with a stated
   reason, never passed**. Confirm that holds on every path — a spec that
   fails schema validation, a bundle with module syntax, a render that
   throws. Reporting an unevaluable bundle as clean is the failure mode
   the gate exists to prevent.

3. **Observation-verified writes.** The design's rule is that a command
   reports success only when it has _observed_ the effect, because
   `ca-create` silently no-ops on a name collision while the tracked poke
   still resolves (D50), and a burned channel name is unusable forever.
   Audit `surface create`, `publish`, `event` and `snapshot` for this.
   Two real defects of this class have already been found and fixed
   (a tracked poke with no subscription open, reporting failure for work
   that landed; and a post-write comparison against a schema-validated
   read-back that stripped the very key being compared, reporting
   `publish-unconfirmed` for a write that landed). **Assume a third
   exists.** Where else is a written value compared against a read-back
   one, and does that comparison use the raw cell?

4. **`--preserve-state` and migration snapshots.** `foldForMigration`
   (`commands/surface-publish.ts`) folds the channel's history against the
   _old_ spec and snapshots that, so a new `initialState` is discarded on
   any revision of a live channel. That is intended. What is not settled:
   is the pending window genuinely one command wide, what happens if the
   snapshot post lands and the description write does not (or the
   reverse), and can a partial hydration produce a snapshot that freezes
   the wrong state permanently? The code refuses on incomplete hydration —
   is the completeness test sound?

5. **The reducer and the op language.** `$actor` substitution, RFC 6901
   pointers, the `~0` escaping rule, the caps in §7. A ship has two
   spellings depending on position (escaped as a path segment, plain as an
   object key). Can a malformed or unusual spec reach prototype pollution,
   unbounded growth, or state a render cannot survive? Are the caps
   enforced where the design says?

6. **Does the doctrine hold up under close reading?**
   `PARADIGM.md` is what stops a bot writing a broken app. Its load-bearing
   rules: state changes are events and UI changes are revisions; `append`
   means duplicates are acceptable, so anything counted uses the
   host-is-the-clock pattern instead; `render` never reads the clock and
   never knows who is viewing; integers only for money and weights;
   identity enters paths only through `$actor`. **What does it not
   forbid that it should?** Session 6 writes seven more templates against
   this document, so a gap here multiplies.

7. **Anything shipping-risky in the new surface area** — the release
   packaging changes (`release-package.ts`, `release-utils.ts`), the
   plugin registration in `openclaw.plugin.json` and the hermes adapter,
   and the CI change that now installs chromium in `bot-checks`.

## What I already know is wrong — do not spend time re-finding these

- `surface preview` cannot fold host events, so host-is-the-clock apps
  capture only their pre-rollover half (D70).
- Preview snapshots `spec.initialState` while production folds the carried
  state, so the populated capture for a `preserveState` spec is optimistic
  (D69).
- Under Hermes, `skill_view` serves `SKILL.md` only, so `PARADIGM.md` and
  the templates are unreachable through the skill mechanism there (D74).
- `surface publish` has no dev-storage path and dies at
  `storage-unavailable` without an S3-compatible endpoint.
- The `countdown` template cannot work under the no-clock rule (D67).

Tell me if any of these is worse than recorded, but don't re-derive them.

## Output

Findings ranked by severity, each with: the concrete failure — inputs or
state, and the wrong result — plus the file and line. Distinguish what you
**verified** from what you **suspect**; say which you did for each. If you
find a coverage gap in the lint, name the construct and the rule that
misses it.

A finding I can't reproduce is worth less than one you've reproduced, so
prefer depth over coverage. If the honest answer to a priority question is
"this is sound", say that plainly rather than manufacturing a finding.
