# Thread sync telemetry

These diagnostics trace observed reply identities through a thread fetch, SQLite,
React Query, and the committed list input. They do not fetch additional server
snapshots, invalidate queries, or repair the database.

## Events

`Thread Fetch Outcome` records each completed `syncThreadPosts` attempt. Normal
successes are sampled at 5%; failures, interruptions, missing rows, and diagnostic
read failures are retained. `trigger` distinguishes `thread_open`,
`missing_parent`, and other callers. A successful response containing zero replies
is `succeeded` with `server.count = 0`; transport failure is `failed` with
`responseReceived = false`. `failureStage` identifies queue, request,
normalization, or database write. Queue, request, normalization, write, and total
timings accompany an attempt ID. With retries, request timing describes the last
request; `requestCount` includes retries.

`server` summarizes the normalized API response; `database` summarizes a fresh,
unjoined SQLite read after persistence. The checksum covers sorted reply IDs, not
contents. The immediate `databaseCheck = missing_rows` is evidence to inspect,
not a sustained-failure verdict: a concurrent deletion can affect that read.

`Thread Catchup Check` runs only for the focused thread in a focused, foreground
screen. It checks on activation, committed query/list changes, and normalized
reply arrivals from thread fetches, subscriptions, and `/changes`. Incoming reply
evidence is recorded before persistence, so a failed write can still be detected.
A missing identity or unsuccessful query status must persist across observations
at least five seconds apart before `outcome = mismatch` is emitted. Pending sends
are excluded; deletion markers follow the screen's filter. Extra replies from
concurrent updates do not count as failures. Older fetch results cannot replace
newer evidence in the diagnostic.

An unchanged mismatch is reported once. A later source or view update that closes
the gap emits `recovered` with the same `checkId`, even when success sampling would
normally omit it. Backgrounding, navigation, and unmount stop the check; unfinished
checks are `interrupted`, not failed. Foregrounding starts a new check.

## Reading an incident

| Evidence | What to inspect |
| --- | --- |
| Fetch failed at `request` | Transport/server request failure; no reply snapshot was decoded |
| Fetch failed at `normalization` | Transport completed, but decoding failed |
| Fetch failed at `database_write` | Decoded replies failed to persist |
| Sustained `database` gap | A received reply is absent from the thread's SQLite rows |
| Sustained `query` gap | SQLite has a reply that the thread's React Query result lacks |
| Sustained `list` gap | The query has an eligible reply that the committed list input lacks |
| Sustained `query_status` gap | The SQLite query is still pending or has failed, possibly retaining cached data |

Filter by `channelId`, `postId`, `jsContextId`, and build. Join fetches to checks by
`attemptId`; use `missingDatabaseEvidence` for the origin of individual missing
IDs when several arrivals overlap. `jsContextId` and `buildInfo` come from the
shared logger. Missing-ID samples are capped at five per stage; counts describe
the full observed gap. No message contents or server error bodies are captured.

`source = local_only` means the check has no server evidence in this activation.
Even `caught_up` only confirms agreement for observed replies: it cannot establish
that the ship received an unseen reply. Parent reply counts are context, not a
completeness invariant. A query error and an empty successful query are distinct.
`observation = list_input` does not prove a cell painted or entered the viewport;
a reply outside the scroll viewport is not a missing-reply failure. These events
diagnose reply membership, not message-content edits or global sync recovery.
