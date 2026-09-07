# Native actual-app scroller baseline

Total elapsed for simulator setup through final verification: **1 h 19 m 26 s**
(2026-09-07 09:20:53–10:40:19 UTC). The eight Maestro attempts total **10 m 30 s**,
including driver and accessibility overhead. App-only action latency was not
measured. These times are not smoothness measurements.

This phase used the normal `App.main` Release preview, normal application flags,
the real local database, actual navigation/composer and the isolated local
`~zod` test ship. It did not use `ScrollStabilityFixture`. The completed
checkpoints span retained attempts and continuations; **there was no single
uninterrupted passing creation-to-thread journey**.

## Completed product checkpoints

- Create a local group and enter its Chat channel through the native UI.
- Send eighteen distinct channel messages through the real composer, including
  short text, wrapping paragraphs and three-paragraph messages. Check exact
  input, cleared draft, ordered accessible paragraphs, no second visible
  matching body and terminal UI delivery state.
- Grow message 12's composer from one line to three, send and clear it; retain
  the one-line, expanded and cleared screenshots.
- Reach older content using actual scroll gestures. In the longer conversation,
  observe the actual latest control, activate it, observe the newest complete
  message, and observe the control disappear.
- Open the newest message's thread through the real Reply menu action. Send
  one exact two-paragraph reply and verify its UI delivery state.
- Return to the channel, find its one-reply summary without exposing the reply
  as a channel post, reenter through that summary, verify retained parent and
  reply, and return again. The final no-send continuation passed.
- Independently read back exactly eighteen channel posts and one reply from
  the test ship. Original post IDs and content remain unchanged, new bodies
  and paragraph order are exact, all authors are `~zod`, and the reply's
  explicit parent ID identifies the intended newest message.

Accessible paragraph checks do not exclude arbitrary extra nonmatching body
content or duplicates outside the visible window. The independent full channel
window and parent read establish the narrower exact serialized backend content
and count. Neither proves crash durability, read/unread behavior or every pixel.

## Retained attempt ledger

| Attempt | Driver time | Result and usable evidence |
| --- | ---: | --- |
| r1 | 23 s | Setup stopped at the Basic group card's aggregated accessibility label. No conversation behavior qualified. |
| r2 | 58 s | Sent three messages. The first two UI body/delivery checks completed; the third exposed the harness's incorrect assumption that native paragraphs form one newline-joined accessibility node. Independent readback confirmed all three exact messages in this separate group. |
| r3 | 21 s | Created group title differed from requested input: `Scroller ntive product-r3-20260907a`. Stopped before Chat. App versus input-driver cause remains unresolved. Later flows check the exact input before creation. |
| r4 | 267 s | Created `Scroll-r4-0907`, completed twelve exact sends, composer changes and oldest-message navigation. Failed expected latest-control visibility. Twelve messages had not independently established the native one-window distance threshold, so this is incomplete threshold qualification, not a confirmed scroller defect. |
| r5 | 148 s | Continued the same group and completed six additional exact sends. The five-second oldest-message search timed out; its final hierarchy and screenshot show the oldest message and latest control. Preserve the timeout; do not relabel it a passing search or infer app-only latency from driver time. |
| r6 | 29 s | Completed actual latest-control visibility, click, newest-message and hidden-control checks. Actual Reply navigation occurred, then the assumed `Thread: Chat` title failed. Native thread title is `Chat`; the Reply composer and exact parent provide the scope witnesses. |
| r7 | 51 s | Completed exact reply input/body/delivery and Back. The harness then incorrectly required the thread-only `ScreenHeaderTitle` identifier on the channel header. Preserve this failed acquisition. |
| r8 | 33 s | Passed the no-send channel-return, retained-thread reentry and second return checks using the observed channel/thread selectors and composer state. No message was resent. |

r4–r8 are successive scopes in one retained conversation. Earlier attempts,
expectations and raw outputs remain unchanged. The replayable full flow assembled
after this phase uses eighteen posts and two bounded history searches; it has
not yet passed as one uninterrupted run. Its later run must be reported separately.

The first full-parent backend lookup used the wrong undotted identifier and
returned 404. Its incomplete report is retained. The corrected external verifier
uses the API's canonical dotted identifier; all four GETs returned 200 and the
complete mixed post/reply contract passed. No test-server data was changed to
make that readback pass.

## Build, account and evidence

The new isolated iPhone 17 Pro / iOS 26.4 Simulator is
`6DBBE7A7-F11A-4133-8B20-25A39B4B980C`. The previously running simulator and its
unrelated account were preserved. Initial and final JS/native account storage
both identify self-hosted `~zod` at exactly `http://localhost:35453`.

- Checkout: `db/scroll-stability-fixture`, HEAD
  `0084cc91f64472848a4e6c75da4256e13d642819`.
- Frozen dirty source snapshot:
  `54dd5665951af376b66169f3cc160f340b3be07c762fd8538cc312f2854611f6`.
- Actual build entry: `apps/tlon-mobile/index.tsx`, `--dev false`; composed
  source map contains normal `App.main` and excludes the fixture entry.
- Native executable SHA-256:
  `7583816a4965d0dbcde82d00039f4db11a1b179b9542c2e49b2f263e2912c003`.
- Artifact and installed embedded JS bundle match byte-for-byte: 21,453,624
  bytes, SHA-256
  `37c94453cfed85d869e698327c12e0ac7a48bb8e09516055425490a728429b2b`.
- Wrapper verification preceded every Maestro attempt and passed again at the
  end. Supplemental bundle and account verification also passed. Argent services
  were stopped only for this phase's simulator.

Raw files are under `/private/tmp/scroller-native-product-r1-20260907/`:
`phase-result.json`, each immutable `flow*` source/contract/manifest, each
`journey*` JUnit/command hierarchy/screenshots, `bundle-final-verification.json`,
`account-final.json`, `verified-final.txt`, and
`backend-r7-continuation-verification-r2.json` with its native provenance file.

The durable local archive is
`artifacts/scroller-baseline-2026-09-07-native-product-and-web-r3.tgz`:
37,486,604 bytes; all 450 file hashes verified; SHA-256
`013b1a4e3da5334fa39aeff65117a210fe6ef1514bbc0cf79bc74adb7ea9965a`.
It also retains the production-web r3 raw evidence and the frozen source.
Earlier archives remain intact. Authentication storage and local ship piers
are excluded.

## Qualification limits and next gate

This adds actual native send, control and thread evidence to the separate
[fixture geometry results](scroller-native-entry-results-2026-09-07.md).
It does not qualify continuous native geometry, first reveal, flicker, frame
presentation, input acknowledgement latency, exact landing pixels, read/unread
side effects, native attachment/loading/thinking races, or the full matrix.

The reproducible lifecycle and product failures are sufficient to start the
refactor against fixed assertions. Starting the refactor does not mean the
suite has met its final qualification gate. The accepted policies, failed
captures, required breadth and remaining evidence stay visible in the
[refactor ledger](scroller-refactor-gates.md) and
[situation matrix](scroller-test-matrix.md).
