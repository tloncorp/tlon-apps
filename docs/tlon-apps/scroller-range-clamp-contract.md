# External-only proposal: FOLLOW after browser range clamp

Status: prepared during frozen native capture; NOT RUN. No repository edits.

Acceptance: Preserve a previously authorized bottom FOLLOW when maximum decreases, the previous offset is now illegal, and the observed offset equals the new maximum. Observe geometry at both scroll-event and reconcile entry so either browser callback order works. This is a legal-range compensation witness; it must neither grant FOLLOW to READ nor change the captured-intent revision. An upward input immediately enters READ and remains READ through a racing clamp. Incomplete newer pagination retains its existing block; future growth may follow only once that block clears. A top-oriented list remains at its authorized top. Unexplained passive movement without the decreasing-range witness still revokes intent.

Eleven added ordinary assertions/cases (two event orders for FOLLOW, upward interruption, blocked FOLLOW, READ, top FOLLOW; one unexplained-motion case). Existing production coordinator is imported; no policy replacement or mock implementation. Original source should fail the two positive FOLLOW and two positive blocked-FOLLOW cases; raw baseline must be collected after freeze release before applying source patch. The source proposal and its controls have not been executed or typechecked.

Boundary: This models DOM range clamps in real controller logic; actual browser presentation and clamp event timing require the subsequent browser product gate. Native geometry behavior is unchanged.

This contract was first saved in the corresponding `/private/tmp` review folder
before its red/green controls ran, and subsequently retained here.
