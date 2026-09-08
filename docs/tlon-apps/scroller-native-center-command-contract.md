# Native center command during row measurement

R4's history setup requested row 111 but left the actual viewport about 502 pt
behind the library's predicted viewport after newly measured rows changed its
position. A later reading-stability failure exposed this, but did not directly
test whether the setup command landed on its requested message.

The standalone `command-center` case was added before repairing command
completion. The existing 38-case core registry and earlier recordings remain
unchanged.

The case starts at the measured legal end of the ordinary mixed-height
production-component fixture. Through the same public PostList handle as
production, issue exactly one nonanimated center request for
`scroll-fixture-111`. Record its exact scope, key and arguments before invoking
the handle. Preserve the same native owner and unchanged data throughout.

Use the existing independently replayed native sampled ruler v2 and clamped
landing calculation. The requested row must be exposed at its reachable center
within 1 pt by 1800 ms from recording start, then remain correctly landed for
the fixed final 1000 ms of a 2800 ms recording. The issuance must be recorded
within the first 250 ms. These deadlines do not restart after measurement,
retry, callback or an initially correct landing.

Neither a fulfilled scroll promise, a completed fixture action, a predicted
offset nor a different centered row proves success. Missing/wrong/repeated
commands, changed owner, missing baseline end position, missing native
measurements and incomplete timing remain incomplete. Wrong landing or later
drift remains a failure. Preserve every invalid sample and the existing 32 ms
acquisition and 125 ms sampling budgets. This case does not prove painted-frame
continuity, user gesture delivery or real-app transport behavior.

A successfully issued public request is the action witness even if it produces
no movement. A fully measured stationary viewport must fail its landing check;
requiring movement to recognize the action would incorrectly mark that failure
incomplete. The request marker and actual invocation share the fixed key and
arguments, while native row geometry independently determines the result.

The R5 Release baseline fails with a 498.0002 pt center error and an occluded
target reading point. All 166 sampled brackets are valid; the last fixed second
contains 62 samples. Evidence and exact installed-source verification are in
`/private/tmp/scroller-native-center-command-r5-20260907`. The dependency repair
and diagnostic hook were both absent during this run.
