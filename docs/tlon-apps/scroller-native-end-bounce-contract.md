# Native end rounding and bounce

Before changing the handler, reproduce the observed native end geometry:
content height 11060.3330078125, viewport 671, bottom inset 98, and offset
10487.333333333334. Its computed distance from the end is slightly negative.
After a history position has shown Latest, this end event must hide it.

The same rule applies while UIKit bounces past the end. Repeated end events
must not toggle the state, and moving back beyond the existing threshold must
show Latest again. Preserve the current threshold, inset calculation, and
suppression of bounce deltas in the separate header animation. A legitimate
position outside the threshold must never be classified as at the bottom.

Exercise the actual scroll hook with native event and Reanimated dispatch
boundaries modeled. These controls establish the state transition only. A new
simulator capture must check the actual control's visibility and geometry;
the earlier native r2 artifacts remain unchanged. Do not claim a presented
frame or complete flicker result from a hook test.
