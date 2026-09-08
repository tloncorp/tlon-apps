# Retained surface focus: bounded pretest acceptance and patch plan

Prepared outside repository during the native build/capture freeze. Applied only
after the parent released the native phase; this acceptance precedes controls.
The 8 proposed controls are in controls.patch and mirror existing component tests.

## Accepted route-cover policy; OS background excluded

Definite existing requirements: AC12 newest valid scoped request; OVR04 deferred
restore loses to navigation; LIF01 scoped restoration; RAC07 overlay capture then
nested navigation; RAC08 old load/send/read completion after a scope switch.
The accepted own-send policy explicitly permits newer navigation to supersede
late completion. A route cover/return cannot resurrect an old pending command.

Parent resolved the bounded return policy before controls: ATT07 requires the
surviving reading point after media + incoming/edit/delete; THR01 requires parent
ID and reading offset on return from top/middle/bottom; OVR05 requires profile/media
reading-point preservation. Apply that to route cover, including old bottom:
blur retires movement and return remains READ hold until a fresh explicit latest
or a real gesture reaches the end. Do not jump to a newly grown end on return.
This is the stated interpretation of accepted return-point contracts, not an
analogy to current web code. OS app background remains outside this patch: no
AppState listener, no new background-resume policy.

Required bounded outcomes:
1. Channel's route focus and thread's route+carousel focus reach their actual list.
   No second useIsFocused hook inside Scroller and no presentation-based fallback
   can substitute for the explicit production focus input.
2. Blur permanently invalidates captured imperative/latest/restore authority.
   A request waiting for loading/readiness and an already dequeued RAF cannot
   issue while covered or after same-ID return. Its old press callback is dead.
3. Anchor retirement performed by a latest press may renew its renderer permit,
   as today, but must never renew that request's initiating focus activation.
4. A retained native end-anchor registration checks captured focused visit and
   renderer intent; its delayed keyboard completion/retry cannot restore after
   blur/return even if no registration or list instance changed.
5. Hide native passive end/keyboard motion while the route is covered, without
   losing rows, content/inset measurement bookkeeping, readiness or draft. Regain
   focus grants new-action authority; it does not dispatch a previous command.
   Cover retires FOLLOW to READ hold even from old bottom; return preserves that
   point until new explicit latest/end gesture. This does not apply to OS background.
6. Current visible latest/imperative/restore still works. Existing child-layout,
   Strict Mode, own-anchor-retirement and direct READ cancellation tests remain.
7. This is lifecycle boundary proof; real route/backend/native movement still
   requires the later actual-app regression, not an injected policy simulation.

## Small API

- `isFocused?: boolean` on PostCollectionContextValue, DetailViewProps,
  ScrollerProps and PostListComponentProps. Standalone fixtures may default true;
  both production owners must explicitly supply it. This is route/carousel focus,
  not idle activity and not app background.
- Scroller owns one existing `useLifecyclePermit` keyed by conversation identity
  and isFocused. Call it `scrollVisit` (existing LifecyclePermit type), and pass
  the same optional object through PostListComponentProps for deferred renderer
  work; do not invent another lease implementation or compare imperative objects.
- Deferred captures compose `scrollVisit.capture()` with renderer intent capture.
  Current direct commands check `scrollVisit.isCurrent()`. `isFocused` supplies
  render-time gating; isCurrent cannot be used as render-time true on initial
  mount, because the lifecycle hook activates in layout after child render.

## Exact future production file edits

1. packages/app/ui/components/Channel/index.tsx: include isFocused:inView in its
   existing PostCollectionContext.Provider value; keep composer and collection mounted.
2. packages/app/ui/contexts/postCollection.ts: optional isFocused metadata.
3. packages/app/ui/components/postCollectionViews/ListPostCollectionView.tsx:
   pass ctx.isFocused to Scroller; no key or data changes.
4. packages/app/ui/components/PostScreenView.tsx: pass existing combined
   isFocusedPost to DetailView; keep current send/read leases and draft owner.
5. packages/app/ui/components/DetailView.tsx: forward optional isFocused through
   its already scope-keyed Scroller; no new key based on focus.
6. packages/app/ui/components/Channel/Scroller.tsx: create scrollVisit; bind all
   exported capture/direct imperative ports, pass to latest and renderer; suppress
   focus-ineligible control publication without treating hiding as cancellation.
7. packages/app/ui/components/Channel/useScrollerLatest.ts: accept scrollVisit,
   capture at press, revoke pending request/frame when its focus visit retires,
   check exact request/focus both before scheduling and inside RAF. Own cursor
   retirement updates renderer permit only, not focus permit. Preserve entry
   readiness; do not key/recreate readiness on route focus or run initial landing
   merely because focus returned.
8. packages/app/ui/components/Channel/PostList/shared.ts: optional isFocused and
   scrollVisit types; no changed external imperative method signature.
9. packages/app/ui/components/Channel/PostList/PostList.tsx: compose its existing
   native intent owner with scrollVisit for initial/retry/direct/capture and
   end-anchor callbacks. Gate passive maintainScrollAtEnd/keyboardLiftBehavior
   while hidden; continue reporting actual composer insets/layout. On blur retire
   capturedEndIntent and pending target/retry ownership, preserving native view.
   Use a narrow owner suspension/revision invalidation to move FOLLOW/TARGET to
   READ on cover, reactivating for new input on return without navigation. Add it
   in nativeScrollOwnership.ts rather than recreating owner/list or clearing rows.
10. packages/app/ui/components/Channel/PostList/PostListFlatList.tsx: apply the
    same shared focused-visit guard to its imperative/captured/retry operations;
    no container replacement. Cancel pending anchor request on focus loss using
    its existing cancelPendingAnchorScroll; no implicit retry on same visit return.
11. packages/app/ui/components/Channel/PostList/PostList.web.tsx and
    useWebScrollCoordinator.ts: combine explicit isFocused with the existing
    surface.visible predicate, call existing visibilityChanged/reconcile when
    focus changes, and compose exported capture/direct navigation with scrollVisit.
    Reuse existing web revocation; do not change its current hidden policy or
    introduce new DOM observers. No webScrollCoordinator class API is necessary
    if the adapter's current inputs can provide the predicate.

Route cover preserves the return reading point, including old bottom: FOLLOW,
pending TARGET and captured restoration retire to READ. OS background is excluded.
No changes proposed to ThinkingState, backend, query cache, upload or policy docs.

## Eight controls prepared, plus existing forwarding assertions

Existing Scroller.native-integration.test.tsx runs real Scroller, DetailView,
ThinkingState and (new bounded import) ListPostCollection; PostList remains its
explicit native boundary. No fake scroll policy is added to that boundary.

1-2. Latest waiting for loading completes while covered or after return; neither
     scrolls, mounted row boundary is retained, and a fresh visible press works.
3. An old already-dequeued latest RAF and old press callback cannot consume a
   newer visible request after focus ABA; the newer frame survives and runs once.
4. Real DetailView forwards false/true without remount; actual Scroller handle
   captured permit remains dead across ABA; hidden direct command is rejected,
   current visible command works, refocus itself sends no command.
5. Real ListPostCollection consumes changed context focus, forwards it and cancels
   pending latest without replacing the list; a fresh visible press works.

Existing PostList.native-ownership.test.tsx runs real native PostList; only
LegendList and native services are boundaries.
6. Blur revokes intent and disables passive end/keyboard following while native
   row boundary and changed inset bookkeeping stay mounted; old permit stays dead
   on return in READ, new explicit latest works. This is route focus only.
7. Force the previously registered captured end-anchor callback after blur/return;
   it does nothing. A newly captured valid visible restore works after explicit end.
8. Force the failed-scroll retry already dequeued before blur; no retry after
   return. A new visible command works.

Existing PostScreenView draft-retention case additionally asserts DetailView gets
false while covered and true after return, while same composer/draft is retained.
Channel's single provider-value forwarding line remains source-inspected in this
bounded patch; the real collection-context consumer is independently exercised.

Run controls against unchanged behavior first (add type-only optional inputs if
necessary for TS), retain red output, then implement and retain green. Do not run
until parent releases native source/CPU. No actual browser/device tests in this task.

## Focus propagation implementation check

The screen/collection/Scroller propagation and request-owner changes were applied
after native source release. The first focused run retained 6 failures and 95
passes: five new Scroller cases failed and the existing draft-preservation case
failed its new focus-forwarding assertion. Existing behavior assertions stayed
green. After the bounded implementation, the combined screen/Scroller/lifecycle
run passed 141/141. Logs: `/private/tmp/scroller-surface-focus-red-20260907.log`
and `/private/tmp/scroller-surface-focus-controls-20260907.log`. Native and web
renderer integration controls belong to their separate implementation owners.
No actual browser/device run was performed for these lifecycle controls.
