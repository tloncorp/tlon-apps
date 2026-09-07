# Native geometry run: 2026-09-07

Total native phase elapsed time was **26 min 02.4 s**, from preparation at 05:06:12 UTC through final wrapper verification at 05:32:14.411 UTC; build completion was 05:20:30.846 UTC. App-only recorded capture windows total **94.67 s** across the 42 selected variants: 79.34 s core and 15.33 s armed. These sums exclude build, setup, dispatch and verification; they are not application startup or interaction-latency measurements.

The verified iOS Release build exercised 38 core scenarios and four additional armed variants. After independent raw replay, the latest attempt for each of these **42 variants has 10 sampled passes, 7 qualified failures and 25 incomplete results**. Fourteen other registered native variants were not run in this phase and are not counted among the 42. These are real native view measurements of the local component fixture, not presented-frame, physical-device, backend delivery or whole-matrix proof.

The build used commit `0084cc91f64472848a4e6c75da4256e13d642819`, dirty source snapshot `d4fad0dbb7ce31bff32620a50cea82006be625fa24ca828ce47fe2eeb1c8abd1`, Simulator `47BA41EE-F11D-4FA3-A8A1-B1400A511A96`, and bundle `io.tlon.groups.preview`. The wrapper's final verification passed before source was released. The subsequent change fixes importer serialization only; the installed app was not changed or rerun for that correction.

| Selection | Raw PASS / FAIL / INCOMPLETE | Independently qualified PASS / FAIL / INCOMPLETE |
| --- | --- | --- |
| Core, 38 variants | 10 / 10 / 18 | 10 / 7 / 21 |
| Latest armed attempts, 4 variants | 0 / 0 / 4 | 0 / 0 / 4 |
| Latest per variant, 42 variants | 10 / 10 / 22 | **10 / 7 / 25** |

All 44 attempts remain preserved: the 42 selected attempts, an earlier keyboard attempt with no interaction, and a separate successful append-history smoke. Across those attempts, qualification is 11 passes, 7 failures and 26 incomplete; the smoke and retry are not extra variant coverage.

## Serialization correction and replay

Every native minimum offset with zero top inset was computed as `-0`. JSON saved that number as `0`; Node's deep strict comparison distinguished the two and initially rejected all 38 core traces. The importer now normalizes signed zero only for legal scroll bounds. Nonzero values still require exact equality. No timing limit, position tolerance, action requirement or raw file changed.

Three new controls exercise an actual JSON round trip, a nonzero inset with a tiny corrupted bound, and a genuine position failure retained after serialization. The focused coverage/importer suite passed **186/186 controls** in 191 ms of test time, 660 ms total. This validates the importer correction, not native product behavior.

## Qualified geometry failures

Indices below are zero-based; time is milliseconds from the independent baseline. Every listed case has complete acquisition and independently qualified action/preconditions. The first five failures are transient: eventual arrival at the end does not erase them.

| Scenario | Concrete evidence | Final state |
| --- | --- | --- |
| `append-end` | Sample 1, +49.15 ms: legal end 10617, actual offset 10487.333; **129.667 pt gap**. Newly appended row 120 begins at y784 below usable bottom y776. | Ends at the legal end |
| `burst-end` | Sample 6, +261.56 ms: legal end 11264.667, actual 11135; **129.667 pt gap**. | End residual approximately 0.000326 pt |
| `thinking-show-hide-end` | Sample 1, +27.83 ms: the actual 52 pt footer increases the end bound while offset remains unchanged; **52 pt gap**. | Returns to the end |
| `thinking-handoff-message-first-end` | Sample 1, +50.03 ms: **129.667 pt gap** after the message appears while the forced production footer remains. | Returns to the end |
| `thinking-handoff-same-frame-end` | Sample 1, +67.79 ms: **77.667 pt gap** after message insertion/footer removal. | Returns to the end |
| `history-reply` | Target row 100 gains a reply count and changes height 121.667→147.333. Sample 19, +376.11 ms: reading row 99 moves y28→y2; **26 pt drift**. Strict mutation semantics pass. | Drift persists |
| `history-cache` | The live row receives the expected cached content and changes height 121.667→1513.333. Sample 21, +355.96 ms: reading row 99 moves y28→y−1364; **1392 pt drift** and loss of visible anchor. Strict mutation semantics pass. | Drift persists |

The history mutation target is a visible non-anchor row **below** the tall reading anchor: row 99 spans y28..629.667; row 100 begins at y637.667. These cases do not prove above-anchor mutation coverage. The thinking cases exercise the real fixed-height production footer through a forced label; backend presence/grace lifecycle is separate evidence.

The ten sampled passes are `append-history`, `burst-history`, `prepend-history`, `stateful-image-load-end`, `thinking-empty-show-hide`, `thinking-label-end`, `thinking-show-hide-history`, `thinking-label-history`, `thinking-handoff-message-first-history`, and `thinking-handoff-same-frame-history`. The image case is the existing gated, same-props native image-load slice.

## Why semantic mutations were incomplete

All 16 mutation cases contain their requested transition and the expected terminal semantic observations. Four pass the strict mutation witness: near-media, near-cache, history-reply and history-cache. The other 12 lose one acquisition interval during the transition. Each has 65–67 terminal samples, no invalid terminal semantic sample, and no unexpected terminal revision. The removal cases record detachment and absent membership rather than a replacement row commit.

For the incomplete transitions, native geometry reads take approximately 0.96–2.03 ms, but the enclosing JS request/receipt interval takes 45.7–114 ms and the recorded semantic state changes across the await. The current strict helper exits with `invalid-semantic-or-geometry-capture`; its `observed:false` then produces a misleading generic `action-not-observed` label. The action exists; its complete temporal proof does not. Those cases must remain incomplete.

For example, history-grow sample 19 covers approximately +317.9..391.9 ms and exceeds the 32 ms acquisition budget. The expected row commit occurs at +371.9 ms and layout at +391.4 ms. The next valid native sample already shows 1392 pt reading drift, but that diagnostic observation does not fill the missing transition interval.

The wider fixture update path calls `update` and re-renders the mounted row set: history-grow/reference/reaction/reply each record 11 row commits within 150 ms of the request. The cache-only path records one. This is consistent with the different JS overlap seen in the traces; it is not a profiling-based attribution of all delay to the fixture or product.

## Remaining core qualifications

| Group | Qualification |
| --- | --- |
| Eight programmatic `near-*` cases | Incomplete for the accepted deliberate-READ policy. A programmed offset never establishes a real user's small upward movement. This includes near-media and near-cache despite otherwise complete semantic/geometry evidence. |
| Six incomplete `history-*` mutations | Grow, shrink, media, reference, removal and reaction each have the transition acquisition loss described above. Retain their drift observations as diagnostics. |
| Three entry cases | Intentional hidden-list stages are rejected by the generic native exposure validator, and some intervals also exceed timing limits. This is a collector scope mismatch for entry concealment, not evidence of unintended blanking. Selected entry additionally retains a 24.167 pt terminal center error, but its whole trace stays incomplete. |
| `empty-first-post` | One acquisition straddles the actual membership change. |
| `stateful-image-load-history` | One 38.9 ms JS bracket exceeds the 32 ms limit; actual native read 6.56 ms. |
| Both hide-first thinking handoffs | A 59.2/65.3 ms acquisition straddles the membership change. |

## Armed native interactions

All four latest armed attempts exercised their named interaction. Their strict incomplete result comes from late or missing acquisition, not from treating intended keyboard/composer displacement as a jump.

| Variant | Actual observed action and geometry | Missing evidence |
| --- | --- | --- |
| `keyboard-end`, retry r2 | WillShow +813.2 ms; DidShow +1287.2 ms. Offset/legal end both 13110→13411, composer y776→475, applied bottom inset 98→399. **301 pt is intended keyboard lift; observed end error is zero.** | Six returned acquisitions exceed 32 ms; one 269 ms timeout. Maximum unobserved interval 269.96 ms. |
| `composer-end` | 138 draft updates; native composer height 64→154.667, offset tracks the actual end 13411→13501.667. Final residual approximately 0.0000203 pt. | 13 invalid acquisitions, including two timeouts; maximum gap 282.33 ms. Exact keystroke correctness is not asserted by this case. |
| `dismiss-history` | WillHide +47.0 ms; DidHide +453.9 ms. Offset stays 11488.667 as usable bottom moves y328.333→629.333. Reading drift is zero. | Four returned acquisitions take 34.1–58.9 ms. |
| `gesture` | Drag +1368.9..2003.7 ms. Actual offset moves −170.667 pt. Across 979 visible, unchanged-height row pairs from adjacent valid samples, displacement residual is exactly zero. | Seven acquisitions take 33.0–52.6 ms. Their missing temporal proof is not repaired by the valid pairs. |

The earlier keyboard attempt has no keyboard events and remains separate as an unexercised attempt. No complete armed case passes merely because its terminal geometry looks correct.

The native capture operation is usually short, but the enclosing bracket includes queueing and JS receipt. A diagnostic constant-clock-offset bound over each short trace places most history-grow delay after the native read and most armed late-return delays before it. That inference assumes fixed clock rate/offset over the capture; it is not presentation evidence or attribution to the app versus accessibility/tooling contention.

## Follow-up work identified by this run

- Separate actual action evidence from complete semantic/temporal verdicts so exercised-but-incomplete mutations are not described as missing actions.
- Keep structural acquisition validity separate from declared entry concealment. An expected hidden entry stage must be recorded as hidden, not treated as an unmeasured native view or visible content.
- Bind semantic revision to the native acquisition instant; a post-await JS render record cannot describe an earlier native view capture. Retain ambiguous transitions as incomplete until that correlation is established.
- Investigate queueing/capture contention with independent timing attribution. A bounded native trace buffer may improve temporal coverage, but native callbacks alone still cannot prove presented frames. Do not increase the 32/125 ms limits or discard bad samples after observing a failure.

## Evidence files

Raw files remain unchanged beneath `/private/tmp/tlon-scroll-stability/geometry-core-20260907` and the five `geometry-*` armed attempt directories. Each now has a `qualification-current.json` with raw SHA-256 hashes and independently replayed status. The full selected manifest and all-attempt ledger are `/private/tmp/tlon-scroll-stability/native-geometry-20260907-latest-manifest.json`.

Supporting artifacts: `/private/tmp/scroller-native-serialization-controls-20260907.{json,log}`, `/private/tmp/qualify-native-geometry-final-20260907.{mjs,log}`, `/private/tmp/scroller-gap-native-inspect-frozen-20260907.txt`, and `/private/tmp/scroller-gap-native-final-verify-20260907.txt`. Earlier `independent-analysis*.json` files preserve the pre-correction investigation; `qualification-current.json` and the selected manifest are the final qualification.
