# Native command completion, identity and recovery

R5 independently reproduces a 498 pt incorrect native landing. Actual dependency
source controls also reproduce requested-offset completion, stale target geometry,
historical-scroll completion, ignored native offset recovery and old callback
ownership failures. A separate audit reproduces successful completion on the
wrong message after data insertion, removal and reorder (matrix NAV-06/RAC-18).

An ordinary iOS command may complete only while its exact request still owns the
operation and an actual native observation matches the current measured target.
The requested offset and MVCP adjustment are not native acknowledgements. A
previous observation is sufficient only for an already aligned no-op with no
pending command/correction and agreeing native and logical positions. Native
event sequence, not millisecond timestamps, distinguishes fresh observations.

The existing bounded dependency retries remain bounded. Exhaustion rejects with
`LEGEND_SCROLL_UNALIGNED`; it does not run successful readiness cleanup. The app
must not silently retry the already exhausted command or treat rejection as
successful entry. While initial entry remains pending, retain the mounted list,
draft and header, and show a scoped error with Try again. A retry consumes its
action once and starts fresh owned work. A covered or replaced route cannot
reuse an old retry, completion or failure callback. Already ready content stays
visible after failure.

Post navigation addresses a message identity. On iOS its item key must survive
deferred dispatch, immutable data replacement, pagination, removal and reorder.
Resolve the current index for that key while the command remains active; never
complete on the new occupant of an old index. Removing the requested key rejects
with reason `target-missing`, including disappearance before public dispatch.
Numeric start/end/index commands and bootstrap retain their declared semantics.
The dependency's existing `scrollToItem` API supplies keyed item semantics to
the app without introducing a separate public navigation API.

Keyed behavior requires an explicitly supplied stable key extractor. The
library's normalized default index extractor must retain legacy item behavior.
A new array containing the same item objects in the same order remains valid
without an unnecessary position rebuild: the actual structural-equivalence
decision may carry forward only a layout stamp that was current before that
replacement. Changed versions, columns, key extraction or item structure must
not inherit a stale stamp. Test these production render paths directly rather
than forcing a position rebuild in the control harness.

Public message targeting uses the visible message body. A row can contain a
leading day/unread divider and separators outside that body. The app may supply
the optional keyed `getViewOffset({ item, key, index, itemSize })` resolver with
the full current offset from measured geometry. The initial selected/unread
cell policy remains separately declared. Missing or stale geometry must remain
unavailable; it cannot default to zero or an earlier captured offset.

Every resolver call must retain the same command, item identity and committed
layout before and after the callback. Reentrant callbacks that replace a
command cannot clear its successor's render range. Data or layout changes
during a callback cannot dispatch the old index or certify the old geometry.
The existing bounded failure path applies. The app matches the native list's
exact eighth-point size normalization and includes that normalization difference
in its geometry calculation, without changing landing tolerances. Native host
measurements and ref ownership require tests against the real component adapter;
a mock that automatically updates retained ref callbacks is insufficient.

Expired MVCP suppression can reconcile logical/pending scroll to an actual
post-adjustment native event only while the same timer and command still own
that recovery and processing is enabled. A queued old timer cannot clear newer
suppression. No fresh native event means no adoption of an older offset. This
reconciliation does not issue native movement or signal readiness.

The first component controls must reproduce failed readiness, extra retry,
stale retry/entry ownership and wrong-item completion before a repair qualifies.
Then run the same controls against both installed native dependency bundles,
the existing visible-ID controls and app checks. Actual iOS comparison must
replay command-center and the affected history cases with unchanged geometry
and sampling limits. Source-level passes do not establish rendered landing,
gesture cancellation or presented-frame continuity.
