# Performance

Benchmarks separate Harness processing from model and network latency.
Measure client wall time, event CPU time, process RSS, and live loom separately.
For sustained operation and recovery, use the [reliability runner](reliability.md).

## Publication selection

Tlon reconciliation filters for this hand's pending publications before sorting.
It resolves admission timestamps once per candidate and uses effect ID as a
deterministic tie-breaker. Delivered records serve as audit evidence rather than
runnable work. Claims, uncertain outcomes and failed records are not retried
implicitly. Destination blocking and authority checks govern delivery.

## Sources of latency

- The browser receives ACP results through an authenticated Eyre subscription.
  Safety polls cover missed events and unavailable subscriptions.
- Runtime file updates propagate tree versions and notify subscribers. Their
  cost depends on namespace contents and subscription structure.
- Session replay and history projections depend on event count. Session-index
  and corpus maintenance contribute additional work when session state changes.
- External inference, network requests and native Tlon publication add latency
  beyond Harness's local processing.

## Browser idle work and subscriptions

An open conversation checks snapshots every 600 ms while loading or running,
and every 10 seconds while idle. Hidden tabs use 2.5 seconds and 30 seconds,
respectively. Session notifications, focus, reconnection, sending and completion
refresh sooner. Sending displays the pending prompt and thinking state before
network acknowledgement. Contiguous stream notifications update the displayed
text immediately without a snapshot round trip; retained transcript rows do not
rerender for each chunk. Revision and UTF-8 byte offsets fence stale text and
recover gaps. Reads are
single-flight; an invalidation during a read gets a trailing read so a stale
response cannot hide the newer state until the next idle interval.

ACP watches `/v1/<connection>/client` through a separate disposable Eyre event
channel. The command channel and durable ACP queue retain their identities.
Eyre events and ACP messages have separate cumulative acknowledgements, batched
over 250 ms during push delivery. RPC results do not wait for those ACKs or for
their send's HTTP response to finish. Concurrent watch/scry deliveries cannot
advance acknowledgement past an unseen ACP frame.

With a healthy watch, queue safety reads use a one-second cadence for pending
RPCs and 15 seconds while idle (30 seconds in hidden tabs). Unavailable watches
restore the existing faster polling and retry subscription after 10 seconds.
Missing Eyre heartbeats for 45 seconds also restore fallback; this is a watch
health check, never an RPC deadline. Reconnecting a watch does not replay RPCs.
A genuinely missing or closed ACP queue uses a fresh connection identity and
rejects unresolved calls with the existing check-before-repeating guidance.

The watch covers this ACP connection, not every hand. Idle snapshot polls catch
changes without matching notifications.

## Performance regression checks

Run deterministic request-count and retention checks without a ship:

```sh
node --test acp/browser-client.test.mjs acp/eyre-subscription.test.mjs
```

Use `PLAYWRIGHT_CHANNEL=chrome` when testing with an installed Chrome. The suite
covers idle/active snapshot budgets with 95 and 4,096 retained messages,
10,000-entry unchanged-history reuse, notification races, stream framing,
ACK coalescing, replay/gap handling, and catalog/conversation-list read budgets.
These checks use request counts rather than CPU timing thresholds.

For the real subscription/recovery boundary on a local development ship:

```sh
SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/private-cookie \
  node tests-js/acp-subscription-conformance.mjs
```

This creates and removes only temporary transport channels. It checks live push,
silent watch loss, fallback, reconnection, and no RPC replay. No conversation,
configuration, inference, or external publication is created.

## Scheduler maintenance

Scheduler maintenance follows changes to jobs, sessions, hand evidence and
permission inputs, or the scheduler's armed deadline. Routine ACP reads and
acknowledgements do not sweep active schedules. The deadline includes busy-job
backoff; a receipt can trigger an earlier reassessment. Active jobs without an
armed timer are checked and re-armed after reload or a consumed wake. Settled
jobs alone do not require a timer.

This cadence does not cache authorization. Scheduled execution and hand delivery
check live authority at their effect boundaries. Local source binding and grant
changes trigger maintenance, and re-enabling a revoked source does not resume
paused jobs automatically.

Settings refreshes retain the identity of unchanged JSON while a view is mounted,
so idle reads do not reset forms or hide their model catalogs. Every refresh
still reads the ship, saved responses fence older requests, and closing a view
releases its shared snapshot.

Model and compaction dispatch stop the synchronous drive loop at their pending
request. A result resumes it through the ordinary event boundary. ACP snapshot
projection shares one replay with the stream lookup. The drive loop keeps no
persisted projection or cache; the event log remains authoritative.

Tool batches advance the drive loop's local view from newly recorded events
instead of replaying the complete log again. Human history reads project a page
after seeking its event cursor, with cancellation receipts kept together. Full
transcript cancellation reads inspect only the latest exchange. Event counting
and cursor seeking still traverse list structure; they do not encode or rebuild
every retained message.

## Full-turn benchmark

The full-turn fixture uses the actual browser ACP client, an immediate local
model, one local HTTP tool, and a second immediate model response. It creates
unique sessions, changes only their configuration, and deletes them afterward.
No paid inference or external publication is involved.

The fixture reports admission, tool dispatch, tool resumption, completion and
total elapsed time, with median, p95 and maximum values. These are client-observed
wall times, not CPU-only measurements or production latency guarantees.

Build and install Harness on a development ship before running the fixture.
Do not run native compilation or other live workloads alongside measurements.
Live benchmarks require `HARNESS_HEAVY_TESTS=1` and a dedicated test ship with a
monitored disk budget. Fixture cleanup does not reclaim retained ship events.

```sh
HARNESS_HEAVY_TESTS=1 SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/private-cookie \
  node tests-js/performance-turn-benchmark.mjs
```

Use `BENCH_TURNS=0,64,256`, `BENCH_REPEATS=5`, and `BENCH_RAW=1` for history
sizes, repetitions, and raw samples. Measure cold starts separately from steady
state, retain outliers, and repeat enough to assess tail latency. Local endpoints
exclude external model, network, and Tlon delivery costs.

`BENCH_MAX_P95_MS` sets a p95 limit; `BENCH_MAX_GROWTH` limits median growth
relative to the first workload. Start with zero prior turns and calibrate on
the same machine. Failed budgets still clean up test sessions.

The read-only transport fixture is `tests-js/performance-read-benchmark.mjs`.
It reports initialization, the parallel Settings read batch, subsequent RPCs
and idle traffic separately. Model-catalog I/O and browser rendering are outside
these timings. Include active schedules when measuring a scheduler workload;
an empty scheduler does not exercise live job-authority checks.

## Native benchmarks and correctness

Pure native benchmarks cover publication selection, session
replay, incremental tool batches, paged and full history, interrupted exchanges,
session indexing and corpus synchronization.
Comparisons include output-equivalence assertions; their timing ratios apply
to the measured operations, not the entire runtime. These files require an
explicit `just heavy=true build` and are absent from the default desk.
Run one from Dojo:

```text
-test /=harness=/tests-integration/harness-performance
```

`tests/harness-hand-pending` covers chronological selection, ties,
missing admissions and non-runnable delivery states. Hand and
live cancellation/fault-injection checks cover the surrounding semantics.
