# Bounded clock correction; acceptance before running controls

Prepared during the native wrapper source freeze and applied after its final verification.
The prepared patch changes only the enclosing clock reader, production-assets
clock predicate, and their existing controls. Reporter output schema stays v1.

Installed Playwright source establishes separate clocks: testInfo.js:63-64
records monotonic start and Date.now start separately; timeoutManager.js:76
accumulates monotonic slot elapsed; workerMain.js:378 serializes summed slot
elapsed as result.duration. Result.duration is not an observed Date.now span.
The existing reporter already documents this distinction.

Required acceptance:
- Preserve exact reporter source/version/test ID/retry/start identity and exactly
  one annotation. Duration remains finite and nonnegative in the reader, strictly
  positive for this actual asset-capture contract.
- Explicit wall end must be finite and not before wall start. Do not compare it
  against wall start plus monotonic duration, and add no tolerance milliseconds.
- Require build finish <= actual asset start <= asset completion <= explicit
  enclosing wall end, plus each response observed within that capture, unchanged
  source/output hashes and actual browser-delivered byte matches.
- An explicit end before the content capture remains incomplete even if the
  duration would appear to cover it. Invalid explicit clocks never fall back.
- Retain existing absent-clock historical behavior and all separate geometry,
  transport, source/byte and native/presentation qualification boundaries.

Healthy control: explicit wall interval [0,3500], monotonic duration3507 and
asset capture ending before3500 must qualify. Counterexamples: reversed wall
end -1, nonfinite/negative duration, content finishing after valid wall end1999,
and tampered browser bytes must not qualify. Existing 1ms capture-overrun,
malformed annotation, wrong identity/retry and independently valid reading-failure
controls remain unchanged except the reversed-clock input now directly reverses
wall endpoints instead of asserting that a duration-derived endpoint is a clock.

Actual retained raw: /private/tmp/scroller-refactor-web-r1-20260907/product-raw.json
SHA256 aa975c3c2f52b49dac37f283d077126c0c0141611a5762111123d9b6c27d7d96.
Original independent-replay.json remains immutable at6sampledPASS/1INCOMPLETE.
Rich history start11:34:01.444Z + duration22874 = nominal1788780864318;
explicit onTestEnd1788780864311 is7ms earlier. Actual asset completion1788780863661
is650ms before that explicit endpoint. A new replay after controls will be written
to a distinct filename, preserving the original assessment and raw report.
