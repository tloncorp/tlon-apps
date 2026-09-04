# Surface Channels v0 — Session 5 Report (authoring infrastructure: commands, gate, preview, skill)

Branch `patrick/mini-app-mvp`. All work is committed locally; **nothing has
been pushed**.

14 commits, `7d8532918d`..`af020ac8d6` — 66 files, +15,426 / −530.

---

## 1. What this session was

Generative, and the first session whose output is consumed by a model rather
than by a person: the `surface *` command group, the publish gate, `surface
preview`, and the four skill documents a bot reads before it writes an app.
Two templates were promoted to prove the pipeline end to end, which is where
most of what is worth reading below came from — the pipeline was correct in the
large and wrong in five specific places, and only running it found them.

The remaining seven templates, the eval harness, and `surface fork` are Session
6, per the prompt.

## 2. Commits

| Commit       | Step | Content                                                                      |
| ------------ | ---- | ---------------------------------------------------------------------------- |
| `7d8532918d` | 2    | D56 fixed: `insertGroups` pinned the raw description cell; convergence tests |
| `716307f98f` | 2    | Plan committed on-branch; §3 amended — change detection keys on cell content |
| `cce0d12ec9` | —    | D59 (D56 root cause), D60 (plan on-branch supersedes D1)                     |
| `bb86ec7ea6` | 3    | Sandbox assembler relocated into the shell; sigil avatar                     |
| `2f9e748a4d` | 3    | Shell artifact minified with `keepNames` (D32 flip)                          |
| `d759aad777` | —    | D65 (the flip, and the silently-ignored config key)                          |
| `73de1793d5` | 7    | `PARADIGM.md`, `PRIMITIVES.md`                                               |
| `a2b25cdfdb` | —    | D66 (skill location + four registration gaps), D67 (five plan errors)        |
| `fc0a399304` | 5    | The publish gate: 14 rules, per-rule self-test suite                         |
| `161d1aff64` | —    | Fix `shellArtifactVersion` reporting 0                                       |
| `fd1de531d0` | 4, 6 | The `surface *` command group and `surface preview`; `RUBRIC.md`             |
| `7f541f4137` | 9    | The ten step-9 quality-control plan amendments                               |
| `5002b721ac` | 7    | `SKILL.md`; fix publish rejecting gate-only spec markers                     |
| `af020ac8d6` | 8    | Poll and workout-tracker templates promoted; `surface create` fixed          |

## 3. Definition of done — status

| DoD item                                                                  | Status                                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| D56 diagnosed with evidence, fixed, convergence-tested both ways          | ✅ stage (a); `7d8532918d`. §3 amendment on-branch in `716307f98f`                                 |
| Assembler relocated; app host + posture suites green against it           | ✅ posture 47 chromium, import path the only edit                                                  |
| Sigil avatar landed; allowlist, depcheck, determinism, artifact           | ✅ plus two riders it dragged in — §5                                                              |
| All `surface *` commands with observation-verified success                | ✅ — and `surface create` was observably broken until step 8 found it (D68)                        |
| Gate complete with per-rule self-test suite                               | ✅ 14 rules; 92 tests (80 gate + 12 lexer); mutation-checked twice                                 |
| `surface preview` full capture matrix, both templates, headless           | ⚠️ **partial** — 12 cells produced and inspected, but the browser leg does not run in CI. §7       |
| SKILL / PARADIGM / PRIMITIVES committed, deviations recorded              | ✅ plus `RUBRIC.md` — but D66's four registration gaps mean **none of it ships anywhere yet**. §14 |
| Both templates promoted, gated, previewed, published, interacted, revised | ✅ live on fakeships — §10                                                                         |
| Step-9 plan amendments applied on-branch                                  | ✅ ten of them, `7f541f4137`                                                                       |
| Full branch green + typecheck clean                                       | ⚠️ green **except** 4 pre-existing `media-guard` TLS failures — §12                                |
| Report + "Notes for Session 6"                                            | ✅ §15                                                                                             |

## 4. D56 resolved, and the ruling survived its own diagnosis

The recorded discrepancy was that a bundle-hash change at an unchanged
`specRevision` never reached a running client. Diagnosed in the prescribed
order; stage (a) swallowed it and stages (b) and (c) were correct.

`insertGroups`' `onConflictDoUpdate` allowlist (`packages/shared/src/db/queries.ts`)
listed `description` and `contentConfiguration` — both **derived** from the
description cell — while omitting `descriptionPayload` (the verbatim cell) and
`surfaceSpec`. It is the only write carrying group-channel metadata on a boot or
a full group sync, so once a channel row existed it refreshed the readable
description and the renderer config while pinning the raw payload and the app
definition to whatever they held at row creation. Two writers of the same table
disagreed: `insertChannelsInternal` uses `conflictUpdateSetAll` with explicit
exclusions and was always correct; `insertGroups` hand-listed columns and
drifted.

**D56 guessed wrong about the mechanism, and the ruling held anyway.** The
bumped-revision case failed identically before the fix, so the swallow was never
keyed on `specRevision` — it dropped the whole cell. What made "bump the
revision" appear to fix it during the session-4.5 demo was a different carrier
landing the change: the live `r-groups` edit fact spreads the full channel into
`db.updateChannel`, which does write both columns. Foreground with a live SSE
connection lands it; recovering via init or group sync never does. Had we
accepted the demo-time fix as the explanation, we would have shipped a
bump-the-revision workaround around a bug that drops the cell entirely.

The unreported consequence was worse than the reported one.
`channelActions.updateChannel` rebuilds the outgoing description from
`currentChannel.descriptionPayload`, so a stale payload meant any routine
metadata edit — a rename, a privacy change — pushed the **superseded spec back
onto the ship**, reverting a bot's republish on the authoritative cell. The
symptom users would report is a stale render; the one they would not is a client
silently corrupting shared state.

Convergence is tested in both directions through the real `%groups` wire
payload. Four mutations, no survivors, two of them discriminators: dropping only
`descriptionPayload` fails the payload assertion alone, and forcing the
reducer's stale-invoke guard never-taken fails only the revision test, so each
test protects its own half rather than both riding on one.

## 5. The shell, and the two riders it dragged in

**The assembler moved** to `packages/surface-shell/src/sandbox/document.ts`, so
`packages/app` and `tlon-skill` import the identical function. That is what
makes "preview equals production" true by construction rather than by
convention. The identity is provable rather than asserted: diffed against its
pre-move blob, the file differs by a header comment and nothing else.

**The sigil avatar** takes a `ship` prop and renders internally from the token
palette, the same un-freelance-able posture as the chart primitive. Three things
reality corrected against the brief (D62): v2.2.0's `/core` returns a **string**,
not the structure "pure core → SVG structure" assumed, so it is parsed with the
already-vendored `htm` into Preact vnodes and never through `innerHTML`; the
core throws through `invariant` on any non-galaxy/star/planet name and `ship`
arrives from app state, so an unguarded call would put the whole app in the
broken-state view, and it falls back to initials; and colors are handed over as
live `var()` references, which buys a property the chart does not have — a theme
flip recolors an already-drawn sigil. Imported rather than injected, deliberately
unlike D58's Chart constructor: a sigil is arithmetic, and injecting it would let
the gate's happy-dom smoke render draw an avatar the sandbox does not, which is
the exact divergence the relocation exists to prevent.

Two riders came with it, neither in the brief:

- **`process.env` in the artifact (D63).** Vite's lib mode leaves the
  `NODE_ENV` substitution to the consumer, but the consumer here is an iframe
  with no `process`. Vendoring sigil-js put five unreplaced reads into the
  artifact, all on its invalid-name path — the path an app reaches by accident.
  Found by grepping the built artifact, not by a failing test, which is why the
  assertion now lives in `check:determinism`.
- **Minify flipped on (D64, D65).** Sigil added +295,855 B raw (+58%) and
  tree-shaking cannot touch it, since both symbol tables are indexed by a
  runtime-computed phoneme. Minified with `keepNames`, the artifact is 528,343 B
  raw / 102.6 kB gzip — sigils land and it still travels smaller than before
  them. `keepNames` costs ~14.7 kB and is worth it because the sandbox is
  deliberately hard to inspect: a shell stack trace over the bridge is frequently
  the only signal available. **A near-miss worth keeping:** the first attempt put
  `keepNames` under `build.esbuildOptions`, which is not a Vite key. It was
  silently ignored and produced byte-identical output. Only measuring caught it —
  a config key that looks meaningful and does nothing is D45's
  dead-code-that-reads-like-protection in another costume.

That flip then broke something silently. The artifact emitter derived
`shellArtifactVersion` by regexing the **built** file for `SHELL_VERSION = (\d+)`;
minification emits `SHELL_VERSION=1` with no spaces, the pattern missed, and a
`?? 0` fallback turned the miss into a plausible number. Everything gating on
`shellArtifactVersion` had been gating on 0. It now reads `src/version.ts` — the
source constant was always the right authority — and exits nonzero rather than
falling back, with `check:determinism` asserting the emitted version equals the
source constant (`161d1aff64`).

## 6. The command group and the gate

**Commands** (`fd1de531d0`): `create`, `templates`, `lint`, `publish`, `event`,
`state`, `snapshot`, `preview`. Every subcommand takes `--json` and prints
`{ok, code, message, details}`, so a bot's self-repair loop branches on a code
rather than on exit status.

Nothing reports success it did not observe. `create` polls `%channels` **and**
`%groups` until the nest is in both and names the asymmetry when only one side
has it, rather than timing out generically; it refuses a burned name before
poking, since D50's re-create is a silent no-op whose poke still resolves.
`publish` re-scries and compares canonical JSON of the spec it read back. Posts
cannot be looked up by a writer at all, because ids are host-stamped (D53), so
they are matched on author + supplied `sent` + exact blob bytes and then
raw-scried to assert `essay.kind` still carries the surface tail — a post that
came back as plain `/chat` is `kind-tail-lost`, not success.

The revision number is **derived, never remembered**: the spec file's own
`specRevision` is discarded, and a content key (canonical JSON minus the
revision, keys sorted at every depth) decides bump versus no-op. The bundle
sha256 is inside that key, which makes D59's defect unreachable rather than
merely tested against. A byte-identical republish is an explicit reported no-op:
no upload, no write, no post.

Thirteen mutations, and **M8 initially survived**. The publish-observation test
swallowed the write, so an earlier status branch caught the mutant and the
content comparison was never exercised — a ship storing a _different valid_ spec
would have been reported as success, which is precisely D59's unreported
consequence recurring in the verification of its own fix. A fake that accepts the
write and keeps its old definition now kills it.

**The gate** (`fc0a399304`) is 14 rules as a module, not a command: the
`commands/` contract test forbids `@tloncorp/api` value imports there and the
gate needs `SurfaceSpecSchema`, `reduceSurface` and `parsePointer` at runtime.
Lexical rules ask their question of the right slice of source — a JS lexer splits
code, strings, template text, comments and regex — so the jargon rule ignores
comments and the external-reference rule sees interpolated markup. Two rules are
behavioral because lexical cannot work: chart sizing asserts on rendered output
through the real shell, with the `new Chart(` grep demoted to a warning and a test
proving it fires inside a comment; and idempotency folds each action once and
twice through the real reducer and diffs canonicalised state, requiring
`duplicatesTolerated` on any action using `append`. **A rule that cannot run is
SKIPPED with a stated reason, never passed** — a spec failing its schema cannot
be evaluated at all, and reporting that as clean is the failure mode the gate
exists to prevent.

Self-test: 92 tests (80 over the gate, 12 over its lexer). One fixture per rule
tripping exactly that rule — asserted as `ruleSet === [rule]`, not "some
violation" — one compliant fixture asserted clean, and a completeness test that
fails if a rule is added without a fixture. Mutation-checked twice: a coarse pass
killed 14/14, then a per-detector pass found **six survivors** — `@import`, bare
`open()`, `font-family`, the style-attribute parser and both smoke-render legs
were masked by sibling detectors. Six isolating tests later, all 44 die. That
pass also found two real bugs: `importScripts` matched the static-import detector
for want of a token boundary, and `@import url()` was reported as a nonsense CSS
property.

One environment finding that will bite the next consumer:
`@tloncorp/surface-shell/node` cannot be used by a package whose tsconfig lacks
`jsxImportSource: 'preact'`. Bun transpiles the shell's `.tsx` with the
**consuming** project's JSX config, so primitives emit React elements and every
render dies. Fixed here; `packages/app` and any future consumer will need the
same.

## 7. `surface preview`

Preview assembles through the relocated `@tloncorp/surface-shell/sandbox` — the
same function `packages/app` calls — drives headless chromium, and injects init
through the real bridge protocol. Four assertions are checked around it,
including one that reads `SurfaceSandboxContainer.tsx` and fails if the app stops
using the shared assembler, so "preview equals production" stays true or the
suite breaks.

Twelve cells: three viewports × two themes × two states. `phone` (390×844) first,
`desktop` (1280×900) second, and a `phone-full` cell that was beyond the brief
and earned its place immediately — at **both** 390×844 and 1280×900 the workout
chart, the element the overflow bug lived in, is entirely below the fold and
appears in no capture. The populated state is produced by mechanically folding
each declared action through the real reducer with synthetic actors, never
hand-invented; a hand-written state proves nothing about whether the app's own
actions produce something legible.

**Honest status on "headless in CI."** The matrix logic, the assembler-identity
assertions, the fold, and the manifest all run unconditionally in CI. The leg
that actually launches chromium is gated on `TLON_PREVIEW_BROWSER=1`, and its own
comment claims "CI runs it with `TLON_PREVIEW_BROWSER=1`" — but the variable
appears nowhere else in the repository, so **nothing sets it and the browser leg
runs nowhere by default**. It is the one skipped test in the `tlon-skill` count.
The images in §10 were produced by running it by hand. This is the same class of
claim the F1 finding taught us to distrust — a passing suite doing rhetorical
work its probe set has not earned — so it is called out rather than counted as
done. Wiring it (a Playwright chromium install plus the env var on the bot-package
job) is a Session 6 item.

## 8. Skill documents

`SKILL.md`, `PARADIGM.md`, `PRIMITIVES.md` and `RUBRIC.md` at
`packages/tlon-skill/skills/surfaces/`, alongside `templates/`.

`SKILL.md` was corrected against what shipped: two templates not nine, `app.js`
not `app.html` (D67 — `buildSandboxDocument` injects the bundle inside a
`<script>`, so an `.html` file containing markup would not run), the preview step
inserted between lint and publish and capped at two repair rounds, the real
command flags and error-code vocabulary, and the note that notification
suppression is best-effort (§8) rather than absolute. Preview is recorded as an
**optional** capability, so a missing headless chromium is a documented fallback
rather than a failure to retry.

Writing it caught two gaps in our own wiring: `SURFACE_HELP` listed seven
subcommands and omitted `preview`, so a model running `tlon surface --help` to
discover the surface area would never learn the preview step exists.

## 9. What template promotion found

Five findings, D68–D72. All but D71 are fixed on-branch.

**D68 — `surface create` could never succeed.** `createSurfaceDeps().authenticate`
opened no subscriptions, but `createChannel` is a **tracked poke** whose watcher
is fed by the subscription stream. With nothing subscribed the watcher can never
fire, so the poke created the channel on the ship and the tracker timed out 20
seconds later, reporting failure for work that had landed. Because D50 makes a
channel name single-use forever, every retry burned a name — **two names are
permanently burned in `~zod/surface-seed`**. Fixed to
`ensureClient(['groups','channels'])`, the same list `groups.ts:1454` uses for
the same reason. The command's own test suite missed it because it doubles out
`authenticate` entirely, which is the general shape of the miss: a dependency
stubbed for isolation is a dependency nothing tests.

**D69 — `--preserve-state` discards the new `initialState`, and preview shows
the opposite.** Publish is correct: carried state wins, which is what preserving
means. Preview is the divergence — it snapshots `spec.initialState`, so preview
renders the _new_ starting state while production renders the _carried_ one.
Anyone previewing a revision that adds a poll choice sees the choice; the running
channel does not.

The authoring consequence is larger than the discrepancy: **data that lives in
state changes by host event, not by revision.** "Add a poll choice" is two
mechanisms — a revision for the handler and the button, an event for the datum —
and nothing in the documents said so before this session. It is the finding most
likely to bite Session 6's seven templates, because every one of them will get
revised at least once.

**D70 — preview cannot fold host events.** Its populated state comes from folding
declared _member_ actions, and a host event is not one. So a host-is-the-clock
app captures only its pre-rollover half: the workout tracker's chart card and
past-sessions card are empty in all 12 cells — the exact elements preview exists
to inspect, absent from every image of it.

**D71 — the gate's computed-invoke rule is right, and nothing taught the pattern
that satisfies it.** Both promoted fixtures tripped `undeclared-action` on a
computed `invoke(...)`. A data-driven `invoke('vote-' + option.id)` loop is the
natural shape for a poll, and it turns the gate's only defence against a typo'd
action id off for the whole app. Both templates now use a **literal handler table
keyed by id**, and render a _disabled_ button for an entry with no handler rather
than a live one that silently does nothing. The pattern is documented in each
template's own comments and `NOTES.md`; **`PARADIGM.md` §2 does not yet carry
it**, and should — see §15.

**D72 — the raw-vs-validated hazard generalizes past the gate.** D67 scoped it to
the gate: `duplicatesTolerated` is not in `SurfaceActionSchema`, `z.object`
strips unknown keys, so a gate reading it off a validated spec would fail every
`append` action including correctly-marked ones. The same trap had already been
sprung elsewhere — `surface publish`'s observation check compared the **validated**
read-back against the **raw** object it wrote, so the marker was present in what
was written and absent from what was compared, and a successful publish reported
`publish-unconfirmed`. Net effect: every `append`-using app was unpublishable
through the exact opt-out the gate requires and both `PARADIGM.md` and the gate's
own violation message promise. The comparison now uses the verbatim cell —
content is the change signal (D59), and the raw payload is the content — with a
test pinning the round trip so a future cleanup to the validated view fails
loudly instead of silently breaking `append` apps again. It was found by writing a
test for something expected to already work.

**Promotion changed the templates, never the gate.** Both defects the gate caught
were real defects in the fixtures (the computed invoke, and "spec" in a
workout-tracker empty state tripping the jargon rule). No rule was relaxed and no
exemption was added.

## 10. The live loop

Run on the fakeships, `~zod:3000` and `~ten:3002`: `surface create` → `lint` →
`preview` → `publish` → cross-ship interact → revise.

- **Interaction.** `~ten` voted from a real browser. `~zod`'s `surface state`
  read `{"~ten":"sushi"}`. A second tap changed nothing — idempotency observed
  live, not argued.
- **The revise cycle.** Republished at revision 2 with `--preserve-state`, and
  **the running `~ten` tab picked it up with no reload**. That is the D56 fix
  exercised in anger rather than in a test fixture: the same class of change that
  never propagated in session 4.5 now propagates to a live client.
- **And it is how D69 was found.** The revision's new poll choice did _not_
  appear until a host event added it — correct behavior for
  `--preserve-state`, and the opposite of what preview had shown.
- **The workout tracker ran end to end too.** `~ten` logged lifts, `~zod` posted
  rollovers, the client derived the progression (squat 20 → 22.5 → 25 kg) and drew
  a real Chart.js line inside its card.

## 11. The render job was vacuous, and the fix was data

The first CI template-render job rendered only `initialState`. That exercised
essentially nothing: **deleting `Avatar` from the primitives kit left the suite
green**, because every crew list sits behind a non-empty state and an empty board
takes the empty branch every time.

Fixed with a per-template `state.json` — a populated example, not a starting
state, and explicitly not published. Mutation-checked afterwards rather than
assumed: dropping `Avatar` → 2 failures; making the sigil never draw → 2
failures; unwiring `Button`'s `onPress` → 2 failures; reintroducing a computed
invoke → the gate test fails.

The job itself is keyed off directory listing in both packages, so Session 6's
seven templates need no runner changes: `packages/surface-shell` renders every
template through the real shell (turning red in the package where a breaking
shell change was written), and `tlon-skill` runs the real gate over every
template and asserts zero violations, zero warnings and zero skips.

## 12. Verification

`api 1047 ✓` · `shared 620 ✓` · `app 539 ✓ +3 skipped` · `surface-shell 68 ✓` ·
`tlon-skill 845 pass / 1 skip / 4 fail` + `hermetic 362 ✓`. Typechecks clean.

The 4 failures are pre-existing `media-guard.test.ts` TLS failures; no commit on
this branch has ever touched that file (`git log develop..HEAD --
packages/tlon-skill/scripts/media-guard.test.ts` is empty). The 1 skip is
preview's browser leg (§7).

`app` 545 → 539 and `surface-shell` 49 → 68 are the assembler relocation plus the
sigil and template suites; `shared` 618 → 620 is the D56 convergence pair.

**One trap worth a line:** `tlon-skill` runs under `bun test`, not vitest.
Running its tests with vitest fails to collect on the `bun:test` imports, which
reads as a broken suite rather than a wrong runner. Use
`bun test ./scripts ./tests/unit` and `bun test ./tests/hermetic`, or
`pnpm --filter '@tloncorp/tlon-skill' check`.

## 13. Environment left running — needs stopping

Two processes are still up on this machine and were **not** torn down:

- **An S3 stand-in**, pid `69623`, listening on `127.0.0.1:4399`, objects in
  `/tmp/s3stub`. `~zod`'s `%storage` is currently pointed at it. **Killing it
  makes the published dashboards' bundles unfetchable**, since the spec's bundle
  URL resolves there; rube's next state nuke clears the ship side of that
  pointer.
- **A vite dev server**, pid `71051`, on `:3010`, serving against `~ten`.

Neither is a test fixture — they are what the live loop in §10 ran against.

## 14. Open follow-ups

- **D66's four registration gaps are all still open, and they are blocking.**
  `packages/tlon-skill/package.json` `files` still omits `skills/`;
  `scripts/release-package.ts` stages only `SKILL.md` + `references/`;
  `packages/openclaw/openclaw.plugin.json` lists the package root and the product
  guide but not `node_modules/@tloncorp/tlon-skill/skills/surfaces`, so **no
  OpenClaw bot loads the skill at all**; and `hermes-tlon-adapter/adapter.py`
  still makes two `register_skill` calls, not three. Everything this session
  wrote for the bot to read currently ships nowhere.
- Preview's browser leg is not wired into CI (§7).
- `countdown` remains unresolvable under the no-clock rule (D67): `render` may not
  read `Date`, so it cannot tick. It needs a host rollover cadence or `$period`.
- Carried forward unchanged from 4.5: no CSP violation listener (blocks D44's
  flip criterion 1); native egress markers uncleared (`WKContentRuleList` not
  built); the D43 redirect residual unmeasured; D47 and D50 want upstream fixes;
  Sol findings 5 and 6.

## 15. Notes for Session 6

Session 6 writes seven more templates against `PARADIGM.md`, `PRIMITIVES.md`,
`RUBRIC.md` and the two promoted examples. This is the authoring workflow as it
actually went, including where the documents were not enough.

**The loop that worked.** Copy the nearer template. Edit `spec.json` and `app.js`
together — action ids are the join, and the gate enforces it. `surface lint` until
clean. `surface preview` and _look at the twelve images_, phone-first. Fix, and
re-preview. Then `surface create` → `surface publish`. Then interact from a second
ship, because a poll nobody has voted in looks fine and tells you nothing. Budget
two preview repair rounds, as `SKILL.md` says; both templates converged inside
that.

### What `PARADIGM.md` missed

- **The literal handler-table pattern (D71).** The doc explains that actions are
  parameterless and that the gate cross-references invoke ids, and then leaves the
  author to discover that the natural loop —
  `options.map(o => Button({ onPress: () => invoke('vote-' + o.id) }))` — silently
  disables that cross-reference for the entire app. §2 should carry the table
  verbatim: one literal `invoke` per declared action, keyed by id, with a
  **disabled** button for an entry with no handler so a missing one is visibly
  inert rather than quietly dead. Both templates model it in their own comments
  today; the doctrine does not, and a model reading the doctrine alone will write
  the computed loop every time.
- **The two-mechanisms rule for state-resident data (D69).** `PARADIGM.md` §13
  covers `preserveState` semantics as a revision concern, and that is not where
  the confusion lives. The rule to state plainly: **anything that lives in state
  changes by host event, not by revision.** Adding a poll choice is an action in
  the spec _and_ a host event carrying the datum; publishing the revision alone
  ships a button for a choice nobody can see. Say it next to the `preserveState`
  paragraph, and say that preview will mislead you here (below).
- **`state.json` as a first-class template artifact.** Not in the brief, and
  required: without a populated example the render job is vacuous (§11), and the
  author never sees their own crew list. Every new template needs one, and
  `NOTES.md` should say it is neither published nor the starting state.
- **The host-event dependency belongs in `NOTES.md`, prominently.** The workout
  tracker's version — "this app does not save a session; the channel host does,
  and if it never runs, 'this session' grows forever" — is the sentence that tells
  an author whether the template is the wrong shape for their request. Any
  host-is-the-clock template needs the equivalent paragraph.

### What the gate got wrong

Very little, and it is worth saying plainly rather than manufacturing criticism.
It caught both real defects in the promoted fixtures — the computed invoke and
"spec" in user-facing copy — and in both cases **the template changed, not the
gate**. No rule was relaxed, no exemption was added, and no false positive
required a workaround. The jargon denylist needed no extension: the six ratified
terms (`rollover`, `revision`, `invoke`, `spec`, `scratch`, `$actor`) were
sufficient for both templates. Extend it when a template's own copy proves a term
missing, not preemptively.

The one gate-adjacent defect was not in a rule but in what surrounded it: D72's
raw-versus-validated comparison in `publish`, which made the gate's own documented
opt-out unusable. If Session 6 writes any code that reads a spec field the schema
does not declare, check which view of the spec it is reading.

### What preview caught that the gate did not

Three bugs, all in shipped-looking output, none detectable by any lint:

- a trailing `·` separator on **every** crew weight line, because the separator
  was joined rather than interleaved;
- `undefined 20 kg` for a lift with no label, from a defaulted read that defaulted
  the wrong half;
- `~ten — 0 sessions` on a fresh board, which is true, useless, and reads as an
  error to anyone who has just created the channel.

Every one of these is legible-output wrong and syntactically fine. This is
preview's entire justification, and it earned it on the first two templates.
Look at the images; do not skim the manifest.

### What preview did not catch, and cannot

- **Host-event-dependent content (D70).** Preview folds member actions only, so
  anything a host event produces is absent from all 12 cells. For the workout
  tracker that is the chart and the history card — the two most complex things it
  draws. Session 6 templates with a host cadence get **no visual coverage of their
  populated half** until `--host-ops` exists.
- **The `preserveState` divergence (D69).** Preview snapshots `spec.initialState`,
  so a revision that changes the starting state previews as the new state and
  runs as the carried one. Preview will actively tell you the wrong thing here.
  Trust `surface state` over the screenshots for anything after revision 1.

### Concrete carry-forward items

1. **`--host-ops` for `surface preview`** — let the populated fold take a list of
   raw host ops so host-is-the-clock templates capture their real screens (D70).
   This is the single highest-value preview change for Session 6's template set.
2. **A dev-storage story for `publish`.** The live loop needed a hand-rolled S3
   stand-in (§13) that is still running and whose death breaks the published
   dashboards. Either document the stand-in as part of the loop or give `publish`
   a local-storage mode.
3. **Audit the remaining tracked pokes (D68).** `createChannel` was not special;
   any tracked poke behind a `deps` seam that tests double out has the same shape.
   Check every `surface *` path that pokes, and check whether any other command's
   tests stub `authenticate`.
4. **Audit the remaining read-back comparisons (D72).** Anywhere an observation
   compares something written against something read, confirm both sides are the
   same view — raw or validated, not one of each.
5. **Wire preview's browser leg into CI** (§7) and close D66's four registration
   gaps (§14), or the documents Session 6 writes against reach no bot.
6. **`countdown` needs a decision before it is written.** It cannot tick under the
   no-clock rule (D67). Either give it a host rollover cadence — which makes it a
   host-is-the-clock template with all of D70's preview blindness — or drop it from
   the launch set until `$period` lands.
