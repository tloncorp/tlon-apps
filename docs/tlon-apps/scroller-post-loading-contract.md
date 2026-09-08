# Missing-parent Post screen recovery contract (proposal; before tests)

The actual r1 navigation capture contains a blank content pane while the parent
Post query has no data (raw samples25–51). Preserve that failure and its JPEG:
/private/tmp/scroller-refactor-web-failure-analysis-20260907/missing-parent-460066.852.jpeg.
This proposal addresses that missing-parent path, not a new navigation framework.

1. From the first committed missing-parent render through initial local query,
   remote thread sync and post-sync local refetch, retain the ordinary Thread
   ScreenHeader, working Back action, and LoadingSpinner. The screen must not
   return an empty pane merely because `post` is absent. The bounded case's
   required channel context also keeps this shell until available.
2. A settled initial local absence may start one current sync attempt. A pending
   local query is not not-found. Successful sync writes to shared DB, then an
   explicit `refetch({throwOnError:true})` must settle before interpreting absence.
   Mere stale render absence after invalidation cannot become unavailable.
3. Catch sync/refetch rejections. A current rejection presents 'Could not load
   this thread.' with the existing secondary 'Try again' button and Back. A
   successful explicit fresh read still lacking a parent presents 'This thread
   is not available yet.' plus the same recovery. Neither is a definitive
   deleted/not-found claim. No timeout, fake minimum duration or automatic retry
   loop is introduced.
4. Ownership is the existing committed LifecyclePermit keyed by route visit,
   parent/channel/author and route focus, plus one local request identity. Blur,
   scope change, unmount or replacement retires the request permanently. Its
   eventual DB write may still populate shared cache, but cannot publish error,
   invoke a later-scope refetch, navigate or regain authority after A→B→A.
   Retry and loading-shell Back callbacks are focus/visit guarded.
5. Already-cached parent content wins over loading/error flags. Keep the actual
   PostScreenView instance and draft while its query refetches or a refetch fails.
   Do not clear data, evict cache, remount the list, or alter normal read/send/
   scroll ownership. The existing authenticated-current-user gate is unchanged.
6. Once the actual subscribed parent and required channel exist, render normal
   content. There is no completion-triggered navigation. Existing normal Back,
   deletion and send policies are not redesigned by this bounded patch.

Source basis: docs/tlon-apps/db-react-query.md specifies staleTime Infinity,
explicit per-post invalidation and preservation of cached data during a failed
refetch. usePostWithThreadUnreads has exact key ['post',id]. syncThreadPosts awaits
API then insertChannelPosts; it does not expose cancellation. TanStack's installed
QueryObserver binds refetch once per observer. No elapsed-time cache assumptions.

Before execution, component controls must reproduce the current blank shell and
uncaught rejection, then verify: unresolved query; sync→pending fresh refetch→
actual data; rejection/retry; settled fresh absence; cached refetch/draft
retention; old-scope rejection; focus ABA completion and stale Back retirement;
unmount completion; and missing-channel shell. These controls mock store/network
boundaries while rendering the actual PostScreen component and real permit hook;
they are component lifecycle evidence, not native/browser paint proof. The
original actual missing-parent journey remains the later integration regression.


Direct-open recovery is part of the loading-shell Back contract: at press time,
call navigation.canGoBack(). If true, use goBack(); otherwise use the existing
useRootNavigation().resetToChannel(channelId,{groupId:route.params.groupId ??
undefined}). This does not need a channel query result and uses the existing
native/desktop navigation path. Both branches require the same current focused
visit, including the route's group context. Old callbacks cannot reset a new
channel or regain authority after a returned visit. Additional controls cover
both live history states, state changed after render, missing group context,
and stale cross-channel/ABA callback retirement.


## Initial-error refetch and retained-header follow-up (before controls)

An initial local query rejection is a settled acquisition, with undefined data.
The current attempt's explicit fresh read may become pending again; that must
not retire/restart the attempt. A fresh error shows Error + Retry once; a fresh
null result shows unavailable-yet + Retry once. The installed QueryObserver
control must establish first-error, pending-refetch, refetch-error, successful
null absence, and preserved cached-parent transitions. Presence means an actual
parent object; undefined→null alone is not a new parent or request scope.

A retained stack route owns its native header options even while another route
covers it. Loading→non-chat inline content while covered must retire that route's
native loading header without changing the covering route's options. Loading→
chat must leave the final chat native title and one Back. Preserve beforeRemove
transition behavior and the shared-parent focus guard for inactive tabs. Before
changing the shared header hook, reproduce this with actual installed React
Navigation core StackRouter descriptors and route-owned navigation.setOptions;
mock callbacks alone cannot prove ownership. These component/library controls do
not establish actual native rendered headers or pixel continuity.


The retained-stack control uses the installed core BaseNavigationContainer,
useNavigationBuilder(StackRouter), actual route navigation objects, and options
descriptors. It renders both retained routes while B covers A, replaces A's
loading header with inline content, and checks A's hidden header and B's unchanged
options before returning. Companion controls retain the final chat header and
exercise the actual router's beforeRemove event. The implementation's distinction
is backed by useNavigationCache's route-key-bound setOptions override; inactive
tabs remain focus guarded because this helper explicitly writes their parent.
