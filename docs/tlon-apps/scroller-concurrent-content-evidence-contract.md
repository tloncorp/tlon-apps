# Concurrent real image loading evidence

This contract is saved before the new implementation and executions. It extends
STA-01 and FLK-07/12 with a bounded two-request overlap, rather than claiming all
media or all concurrency. Four desktop cases use normal application flags and
actual local-ship ChatMessage rendering: FOLLOW and deliberate READ, each with
portrait-first and landscape-first completion. Vite development assets are not
built-production parity. Mobile web and native/presented-frame proof are excluded.

One immutable post contains two unknown-size images followed by one declared,
unchanged paragraph. The portrait is a deterministic 720×1080 PNG; the landscape
is 1280×640. Both contain visible coordinate grids, colored regions and binary row markers,
so they are informative media rather than two-pixel shape proxies. Source paths
are unique to the attempt. Real browser requests for both images are held and
fulfilled independently with these actual bytes. No product DOM or application
state is fabricated. The containing essay and stable post ID are read from the
actual backend before and after the capture.

| Situation | Independent acceptance |
| --- | --- |
| Both requests pending | Two distinct requests exist and both original images have zero natural dimensions; at least250ms is recorded before the first release. Expo's actual reserved empty image area is allowed; no invented spinner/skeleton is required |
| First completion | The declared first request is fulfilled, followed by an actual trusted load and decode for that exact source/original image. The other request remains held and its image remains undecoded for at least250ms after the first decode |
| Second completion | Only after that mixed ready/pending interval is the other request released. Its own trusted load/decode establishes the declared intrinsic dimensions. First-image readiness must never revert |
| Quiet tail | Both exact images are decoded before an independently marked terminal time, followed by at least1000ms of complete evidence. No error fallback, duplicate source, replacement node or stale/currentSrc mismatch is accepted |
| FOLLOW | Actual list bottom stays within1CSSpx throughout the capture; latest control stays hidden and its semantic icon is not replaced by a loading state. The unchanged paragraph's interior character stays exposed and within1CSSpx of its baseline |
| READ | Real wheel input establishes an exposed paragraph character and more than300CSSpx to latest before recording. That exact character stays within1CSSpx despite resizing images above it; the latest control remains hidden under the explicitly declared near-bottom eligibility, with the correct icon inventory |

All expected image identities and the complete row image inventory are retained.
Offscreen image pixels may legitimately clip while the user reads the paragraph;
only exposed image regions require visible styling and an unobstructed interior
hit witness. The paragraph remains independently exposed. An observed landscape
reservation-height change greater than16CSSpx is required, linked to its load;
portrait decode need not change row height because its final height may equal the
unknown-size reservation. This distinction prevents inventing two layout changes.

The composition reuses existing production-facing image, reading, chrome and
geometry collectors. Each stream must independently cover the declared interval,
with gaps at most100ms and acquisition at most32ms. Their performance-clock
markers and overlapping geometry must agree; this is bounded asynchronous DOM
observation, not one native or presented frame. Collectors stop before artifact
serialization where their existing APIs permit, and final capture gaps remain
fail-closed. No producer PASS flag is trusted by the independent replay API.

Pure controls must reject missing or duplicated asset identity, wrong dimensions,
reversed/insufficient completion order, forged/untrusted events, stale readiness,
error fallback, missing backend identity, hidden/covered media, unexpected latest
control state, reading drift, weak contracts and truncated/sparse capture. Healthy
controls cover both declared completion orders and both positions. These controls
are detector validation, never actual-product passes.

Image failure/retry, source replacement, request cancellation, references, audio,
video, upload/composer changes, user scrolling during decode and simultaneous
resize callbacks are explicitly future cases. This first slice proves overlapping
in-flight loads with controlled completion order, not every asynchronous race.

## R1 accounting corrections, saved before recapture

The actual backend preserved every declared field but serialized image-object
keys in a different order. Equality now compares objects structurally while
preserving array order. Reordered keys must pass; changed fields or image block
order must fail qualification. The original R1 report is retained unchanged.

READ in this fixture starts 490 CSS px from latest in a 699 CSS px viewport.
Production Scroller supplies a one-viewport proximity threshold, so its latest
control is correctly hidden here. The named variant is **history near bottom**;
its raw proof declares that eligibility from geometry and the fixed source
threshold. It exercises hidden-state stability during overlapping loads, not an
appearance/disappearance transition. A threshold crossing invalidates this
constant-eligibility slice instead of calling a legitimate fade flicker.

Reading acquisition keeps the original scoped DOM block when its positional
selector changes because another wrapper/sibling changes. Exact semantic-text
candidate counts still expose ambiguity. A replacement of the acquired DOM
element makes retained-handle continuity INCOMPLETE; a same-looking clone alone
is not evidence of a user-visible defect. Actual wrong text, blank content and
measured character drift remain independent failures.
