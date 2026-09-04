# Sol review r5 — dispositions

One entry per finding in `surface-channels-sol-review-r5-findings.md`, which
reviewed the fix round that answered r4. The findings are in that file,
verbatim; this file says what was decided and names the control.

**All six were actioned.** Nothing was declined and nothing was deferred.

**Four of the six were introduced by the round they reviewed** — findings 1, 3,
4 and 5 are all repairs to repairs. That is the useful result of pointing a
review at a fix round, and it is worth saying rather than absorbing quietly.

**Every control entered the tree with its mutation applied and observed
breaking it.** Where the pre-fix behaviour is the finding, the output is quoted.

---

## The two release-blocking gaps

### 1. High — migration writers can launder a head-exceeding snapshot — **fixed, D199**

Three folds omitted `advertisedHead`, and all three WRITE a snapshot from their
result: the carry-across in `repairPendingMigration`, the exact-republish repair,
and the preserve-state publish fold. So a snapshot claiming coverage beyond the
real head was folded and its state re-emitted under an honest-looking boundary
that every client accepts.

**Where the boundary is, and why the fix is a type change.** The previous round
wired the head into `surface state` and `surface snapshot` and left the
parameter optional. The reviewer put it better than a fix comment could: *the
optional parameter makes future omissions easy, and this range already missed
three.* So `advertisedHead` is REQUIRED on the reduce input — an omission is a
compile error, and `null` is a visible decision rather than an unwritten field.
Making it required found exactly the three sites the review named, no more and
no fewer. `repairPendingMigration` takes the whole hydration instead of a bare
post array, so the posts and the head they arrived with cannot be separated.
All three folds now refuse on `headExceededSnapshots`, because all three write.

**Controls** (both the reviewer's, verbatim): preserve-state publication over a
current-revision inflated snapshot must return `snapshot-head-exceeded` with
zero definition, mirror and snapshot writes — asserted against the write log and
by naming the absent `specRevision: 2` entries rather than only counting posts.
And pending repair over an inflated PREVIOUS-revision snapshot must refuse with
zero posts written; that arm first asserts the premise that makes it subtle —
`surface state` reports `migration-pending` with an EMPTY `headExceededSnapshots`,
because selection drops the wrong-revision candidate before it ever compares
boundary to head, so the command's own fold is blind to it.

Both have positive arms — an honest boundary must still publish and still
repair — so the guard is observed not firing. An opposite mutation (refuse
unconditionally) fails those arms plus 36 existing tests.

**What the mutation produces is worse than "state is wrong".** Run end to end,
the pre-fix repair path exits 0 and posts
`{"type":"surface-snapshot","specRevision":2,"upToSequenceNum":1000000,"state":{"bringing":{"laundered":true}}}`
— carrying the inflated boundary *forward into the new revision* along with the
corrupt state, because the repair's boundary is `carried.newestFoldedSeq`.

### 2. High — numeric-head completeness hides an omitted tied event — **fixed, D201**

`syncInitialPosts` asks the backend for a COUNT — 30 or 50 posts — and the
backend serves a count, not a tuple cursor. A tied pair straddling that boundary
arrives as one row. Locally nothing looks wrong: newest matches the advertised
head, oldest is sequence 1, both numeric coverage tests pass, and hydration
reports `hydrated` over a fold missing an event. A client already caught up
folds both.

**Where the boundary is.** The acquisition, not the paginator. The page cursor
added last round orders rows the client HOLDS; this row was never acquired. Same
class as the finding it answered, one layer further out.

**The fix, and the signal that made it affordable.** The first attempt probed the
boundary rung unconditionally and broke a property the existing tests pin —
*everything was local; the network was never touched*. The resolution is exact
and free: **a page that came back FULL may have been cut mid-rung; a page that
came back short proves it was not.** A fetch returning fewer rows than it asked
for reached the end of what exists. So the probe fires only after a full page,
which is precisely what a count-limited sync produces and never what a
fully-local walk ends in.

Two further details are part of the fix rather than incidental. The probe takes
only the rows ON the boundary rung — whether the rung is whole is a different
question from what lies beneath it, and dragging in what lies beneath paged a
snapshot-covered channel back to its start for nothing. And it is answerable at
all only because `syncSequencedPosts` fetches by sequence RANGE rather than by
count, so a range covering the rung returns every row on it even though the wire
cannot express a tuple cursor.

**Controls:** the reviewer's own — seed one sibling locally, advertise the
correct numeric head, put the other in the backfill source, require hydration to
fetch it — plus its converse, that a short final page vouches for its own rung
and costs no network. Without the second arm the fix would be "always spend a
round trip", which is a different change with a cost nobody asked for.

---

## Mediums and Low

### 3. Medium — the chat scroller still drops ties across pages — **fixed, D200**

The root cause is worse than a missed call site. The tuple cursor was named
`cursorPostId`, and `useChannelPosts` already had a field of that exact name
meaning something else entirely — the unread-marker cursor naming the post to
open at, which `normalizeCursor` resolves and then CLEARS. The scroller could
not have passed a tie-break key if it had tried.

Renamed to `cursorTiePostId`; both page directions pass it. The page-param
builders are extracted from the hook as pure functions — not tidiness: the
defect was an omitted field in an object literal buried in a `useInfiniteQuery`
config, where nothing could see it and no test could reach it.

**Control:** both builders must carry the id, and `normalizeCursor` must clear
the marker while preserving the tie cursor. Removing the field from the builders
fails exactly the two builder arms.

### 4. Medium — the re-read did not guard the whole cell — **fixed**

`channelWriteIdentity` compared six fields while the payload also replaced
`section`, `readers` and `join`. The comment above it claimed it covered
everything the write overwrites, which made it worse: the false claim is what
stopped anyone counting.

**Fixed structurally rather than by extending the list.** The payload
construction is extracted as `buildChannelUpdate`, and the identity is *computed
from that builder* over the channel as observed. A field added to the payload is
covered the day it is added; there is no second list to drift. `added`'s
`Date.now()` fallback is held constant in the identity — comparing two clock
reads would refuse every edit to a channel with no `addedToGroupAt`.

**Controls:** vary only reader roles; only the nav section; only the join flag.
Each must refuse with zero writes, asserted on a capture that keeps the WHOLE
channel value, since those three live outside `meta` and the existing capture
could not see them. Plus a differential arm that writes all three when nothing
moved, which also proves they are really on the wire. Narrowing the identity
back to six fields fails the three new arms and leaves the twelve existing ones
green — the guard passing and writing.

### 5. Medium — the schema change could freeze published surfaces — **fixed, D198**

Taken first of the six, because it is a compatibility break in shipped code.
`SurfaceSpecSchema` is the READER: `readSurfaceSpec` runs it over the
description cell of every channel a client opens, and a spec it rejects is
`invalid`, which hydration treats as "never fold, never fall back". So the
refusal added last round was retroactive — a live board goes dark on upgrade
with its event log intact underneath. The shape was publishable: this project's
own fork fixture carried it.

Split into `PublishableSurfaceSpecSchema`. Every writer validates against it —
the gate, the preview, publish, fork — and no reader does. A protocol version
bump plus a migration is the right answer to a change in what a spec MEANS and
is disproportionate to a marker that was always inert.

**Control:** a spec the base publisher accepted must still read `valid` through
`readSurfaceSpec` end to end, while the publishable schema refuses it. Putting
the refusal back on the reader fails it.

**The general rule, recorded because it will recur:** adding a constraint to a
validator that runs over persisted data is a data migration wearing a schema's
clothes. Which side of the read/write boundary it belongs on is a separate
question from whether it is correct, and has to be asked first.

### 6. Low — the validator could certify absent or disabled controls — **fixed**

Three false greens, all three closed. A deleted index now fails when git tracks
it and only notes-and-passes when git has never heard of it. `:0` is rejected
outright. A cited test title found only inside `test.skip`, `it.todo`, `xit` or
a comment no longer counts as a live control.

**Honest limits, written into the script rather than into this file only.** The
past-EOF change from `Math.max` to per-number is behaviour-identical for the
ceiling, so no test pretends otherwise — the real hole was the floor, and that is
what the controls demonstrate. The skip detection is a DENY-list on purpose: an
unrecognised-but-running form is still accepted, so the check invents no new
false failures. It cannot see a live `it` inside a `describe.skip`, an `it.only`
elsewhere in the file, or a suite the runner never loads; the comment says so.

**Controls:** a new `node --test` suite, 23 cases, each copying the real script
into a throwaway git repo and asserting on exit code and message. Eight separate
mutations were applied and observed, including one per pre-existing check to
prove the new suite did not weaken them.

---

## What this round did not change

The known-open items stayed open and none of them grew: the `%groups` CAS
window, `around`'s deliberate tie-retention limitation, the hand-edited staged
id, the ownership-scoped drift rule, and the absence of native tests. The
reviewer explicitly did not count them as findings, and nothing here makes any
of them worse.
