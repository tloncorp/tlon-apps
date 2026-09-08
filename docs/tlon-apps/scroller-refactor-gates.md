# Scroller test hardening and refactor

**Full suite qualification is open.** The structural refactor is committed as
`2fed3a9567`; capture corrections and failed-send coverage are committed as
`069853940e`. Neither commit establishes zero jank across the required matrix.

This page lists the current gates. Historical attempts, original failures and
superseded checkpoints remain in the [results ledger](scroller-refactor-results-2026-09-07.md)
and Git history. A later pass does not rewrite an earlier failed or incomplete
capture.

## Contract and order

The [situation matrix and accepted policies](scroller-test-matrix.md),
[historical regressions](scroller-regression-history.md), and detailed acceptance
contracts define the scope. Declare a new case's acceptance before implementing
or running it. Mobile web is excluded; the other accepted platform, presentation,
concurrency and endurance requirements remain applicable.

The refactor entry gate and final qualification gate are distinct. Preserve and
commit a reproducible failing baseline, refactor against it, and repeat the same
behavioral checks. Renderer replacement is a separate decision requiring evidence;
reorganizing Scroller does not imply replacing its renderer.

## Latest verified checkpoint

- App checks: 3,056 actual passing assertions, three existing skips across
  131 files; TypeScript passes. These counts include harness controls and are
  not counts of qualified product scenarios.
- Production web R3: all four concurrent image-loading cases and the real older
  pagination failure/retry case pass independent sampled-behavior replay.
  This verifies the restored one-viewport Latest visibility rule. Headed and
  presented-frame qualification remains separate and incomplete.
- Desktop R8: 50/50 actions execute; independent assessment is INCOMPLETE for
  reading and thinking acquisition gaps of 100.7–103.1 ms. Wheel and input
  delivery checks qualify. Headless Chromium, Vite development assets, no extra
  Playwright trace/video recording.
- Native R27: reaction mutation and bound-anchor continuity pass over 106 native
  frames with zero drift. The shared JS/native acquisition remains INCOMPLETE.
  This is a Release fixture's model geometry, not ordinary App.main continuity
  or presented-frame proof.
- Failed-send R5: the real same-post Retry passes independent sampled-behavior
  replay in 22.371s total. Browser initiation, durable identity, later READ
  ownership and the terminal tail qualify. The original R2/R3 ordering
  failures remain preserved. Presented frames and caret geometry stay open.

Exact attempts, elapsed times, source identities and raw artifacts are linked in
[refactor validation](scroller-refactor-results-2026-09-07.md).

## Final qualification gates

| Gate | Required evidence | Current boundary |
| --- | --- | --- |
| Semantic states | Every required request/revision phase, correct terminal state and independently declared quiet tail; missing, skipped and stale phases rejected | Core readers and controls exist; pending/stateful revision and overlap cases remain |
| Visible content | Correct child identity/text/revision and inner reading point, with clipping, obstruction and blank/flicker detection throughout transitions | Actual content cases exist; source replacement, broader interior content and presented frames remain |
| Input | Exact draft, selection, composition, focus and delivered action; bounded visible acknowledgement and reachable controls | Draft/edit/undo/redo/send slices exist; caret, IME, keyboard reversal and presentation remain |
| Journey and ownership | Correct first reveal/target, legal trajectory, newer-input/scope cancellation, no late correction, correct Latest visibility and activation | Lifecycle baseline and focused cancellation checks exist; wider loading, pagination, unread and interruption paths remain |
| Real product integration | Actual navigation, read/unread, thread, send/echo, attachments and thinking paths with verified side effects | Desktop product cases and native App.main checkpoints exist; uninterrupted native continuous evidence remains |
| Baseline preservation | Reproduced historical/current defects stay detectable; insufficient captures remain incomplete | Original attempts retained; new fixes require fresh evidence at the relevant scope |
| Refactor regression | Same baseline corpus, accepted policies and thresholds before/after; no test-only change to product behavior | Structural changes and app checks pass; full product qualification remains open |
| Presentation and breadth | Production settings and assets, required desktop engines/wrapper, physical Release iOS/Android, presented frames, required combinations/seeds and endurance | Partial production/native evidence exists; full platform and soak requirements remain open |

The next concrete gaps are send while loading;
stale image/reference/A2UI revisions and remounts; multi-scope unread effects;
keyboard reversal and keyboard/composer/image/thinking overlap; and ordinary
App.main lifecycle coverage. Exhausted/duplicate/filtered pages, out-of-order
catch-up, offline/background sends and duplicate echoes remain separate cases.
The 100-navigation/send-cycle, 30-minute soak and 10,000-row requirements cannot
be replaced by increasing a short session's action count.

Report detector controls, component tests, product E2E, sampled geometry and
presented-frame results separately. Acquisition completeness is not a product
pass. Do not widen thresholds, discard failing attempts, accept only the final
landing or mark an entire matrix family covered by one related slice.

## Supporting evidence

- [Execution guide](scroller-test-execution.md) and [browser focus policy](scroller-browser-focus.md)
- [Original product baseline](scroller-product-baseline-2026-09-07.md)
- [Normal native product checkpoints](scroller-native-product-results-2026-09-07.md)
- [Native acquisition and qualification](scroller-native-geometry-results-2026-09-07.md)
- [Scroller lifecycle plan](scroller-native-integration-plan.md) and [screen lifecycle plan](scroller-screen-integration-plan.md)
