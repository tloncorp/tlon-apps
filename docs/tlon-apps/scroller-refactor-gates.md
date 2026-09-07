# Scroller test hardening and refactor

The user authorized closing the recorded blind spots, then refactoring the
scroller. The existing situation matrix and accepted policies remain the
contract. Known failures are baseline evidence, not permission to change those
policies. Mobile web remains excluded.

**Refactor entry and final qualification are separate gates.** The recorded
114 lifecycle cases (75 passing, 39 failing), independently reproduced product
failures, production-web loading cases and actual native send/control/thread
checkpoints provide a reproducible baseline for starting the refactor. Commit
that baseline without weakening its failures. Full suite qualification still
requires the remaining applicable matrix evidence; neither this decision nor a
large detector-control count establishes zero jank.

## Order and scope

1. Strengthen semantic, visible-content, input, trajectory and presentation
   evidence. Calibrate each detector with healthy and deliberately broken input.
2. Connect those checks to real desktop and native product paths. State which
   callbacks, transport, persistence and platform boundaries are substituted.
3. Reproduce the historical and current failures under the stronger checks.
   Retain raw failing attempts and incomplete captures.
4. Refactor Scroller orchestration and its coupled list/scroll state against
   that baseline. Separate readiness, request ownership, user intent, geometry,
   controls and row interactions. Renderer replacement is a separate technical
   decision requiring evidence; it is not implied by reorganizing Scroller.
5. Repeat the same checks on desktop web and iOS Simulator, then qualify the
   remaining declared platform, physical presentation, concurrency and soak
   requirements. A shorter passing run cannot stand in for those requirements.

## Gates

| Gate | Required evidence | Evidence after initial hardening, 2026-09-07 |
| --- | --- | --- |
| Semantic states | Every required request/revision phase, correct terminal state and independently specified quiet tail; injected skipped/stale phases rejected | Strict immutable phase/revision checks implemented; 12 native mutation transitions lose acquisition coverage and remain incomplete despite expected terminal state |
| Visible content | Expected child identity/text/revision, reading point, clipping and obstruction throughout capture | Real same-message image/text loading exposes 100 px interior reading drift; real uncached reference load/edit exposes 24.90/42 px drift at latest and history; general content and native paint remain unqualified |
| Input | Exact draft, selection/composition/focus, scoped delivered actions and bounded visible acknowledgement | Three actual composer cases plus incremental keyboard latest/history runs; keyboard r3 reproduces unreachable Send by Tab and an 11.5 px latest gap during Shift+Enter. Exact draft/edit/undo/redo/send subcriteria qualify; caret, IME and presented acknowledgement remain incomplete |
| Journey and ownership | Correct first reveal and target, legal trajectory, cancellation by newer input/scope and no late correction | 114 component/screen lifecycle cases record 39 failures. Actual cached-parent pending-sync cancellation passes; missing-parent reference cancellation exposes 24 unlabelled blank DOM samples spanning 337.3 ms. Three independently qualified native entry recordings add two row-model passes and a persistent 24.167 pt selected-target error. Whole native journeys and presentation remain incomplete |
| Real product integration | Actual navigation, read/unread, thread, send/echo, attachment and thinking paths with exact side effects | Desktop image/text, composer and uncached reference load/edit cases use actual conversations and normal flags. A normal App.main iOS run adds eighteen exact channel sends, actual latest activation, a correctly parented reply and thread return/reentry checkpoints across retained continuations, with independent backend readback. It is not one uninterrupted passing journey and does not qualify continuous native geometry or read/unread effects. Fixture callbacks remain separate evidence |
| Baseline | Stronger tests preserve all reproduced failures and disqualify insufficient captures | Historical seven-case desktop replay remains 1 pass / 5 fail / 1 incomplete. Four concurrent-image cases add 2 pass / 2 fail with exact 100 px interior drift in READ. New buffered native acquisition is 38 complete / 4 incomplete, separate from those 42 cases' shared product-scope replay of 9 sampled pass / 8 fail / 25 incomplete. Programmatic `near-cache` positioning cannot establish deliberate READ; acquisition complete never grants a product pass |
| Refactor regression | Same baseline corpus, accepted policies and thresholds before/after; no test-only behavior change | Not started |
| Presentation and breadth | Presented-frame evidence, production settings, required combinations/history seeds, device/browser coverage and soak | The latest result per six verified production-web content variants is three passes and three 100 px reading-point failures; the three corrected r3 attempts independently qualify two passes and one failure with no incomplete evidence. Earlier setup/clock failures remain retained. Native buffered model geometry and actual-app accessibility checkpoints do not prove presented frames. Required breadth and soak remain open |

Detector controls, production component tests, product E2E, sampled geometry and
presented-frame results must be reported separately. None is a substitute for
another. Record incomplete work as incomplete rather than widening thresholds,
discarding old failures or calling every linked matrix family covered.

New detailed acceptance contracts are saved before their respective tests run.
This document is a work ledger, not execution evidence or a claim that the full
suite is qualified. Refactor entry depends on retaining the concrete baseline,
not on postponing all product fixes until every broader experiment is complete.

Evidence: [actual product baseline](scroller-product-baseline-2026-09-07.md),
[normal native product checkpoints](scroller-native-product-results-2026-09-07.md),
[native acquisition and qualification](scroller-native-geometry-results-2026-09-07.md),
[Scroller lifecycle plan](scroller-native-integration-plan.md), and
[screen lifecycle plan](scroller-screen-integration-plan.md).
