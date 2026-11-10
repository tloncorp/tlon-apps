# Sustained operation and recovery

The soak runner measures sustained operation and recovery with concurrent
clients on a local test ship.

## Local acceptance runner

`tests-js/reliability-soak.mjs` runs the actual browser ACP client in Node, using
multiple independent connections and a separately observed read workload.
It refuses non-loopback URLs and checks both the host and authenticated ship
against `SOAK_EXPECT_SHIP` before creating transport connections. Use a disposable
local ship. Do not run native compilation alongside latency measurements.
The runner requires `HARNESS_HEAVY_TESTS=1`. Monitor pier size and available disk:
even read probes produce transport events, and deleting fixture sessions does
not reclaim the ship event log. The opt-in is not a disk quota.

Start with application reads only:

```sh
HARNESS_HEAVY_TESTS=1 SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/local-cookie \
SOAK_EXPECT_SHIP='~your-test-ship' node tests-js/reliability-soak.mjs
```

The read probes cover basic HTTP responsiveness, Settings, the Notes-backed
artifact directory and unified search status. Additional connections remain open
and exercise the browser transport's idle subscription behavior. This is **not**
a rendered-tab test: it does not exercise React polling, layout, service workers
or browser memory.

To exercise accepted work and recovery, add `SOAK_WORK=1`:

```sh
HARNESS_HEAVY_TESTS=1 SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/local-cookie \
SOAK_EXPECT_SHIP='~your-test-ship' SOAK_WORK=1 \
SOAK_DURATION_MS=120000 SOAK_TURN_INTERVAL_MS=1500 \
node tests-js/reliability-soak.mjs
```

Work mode creates test conversations using a local synthetic provider and HTTP
POST tool. It counts every effect, including duplicates, against the real head.
It makes no paid calls, public posts, Notes writes, or global configuration changes.

The first worker cycles through these cases; other workers continue ordinary
local tool turns concurrently:

| Case | Required evidence |
| --- | --- |
| Ordinary turn | One effect, its actual tool receipt and completed inference |
| Silent watch loss | Polling delivers the result; the real heartbeat guard restores the watch without resending an RPC |
| Originating client closes after the effect | A new client observes completion; the already accepted effect occurs once |
| Provider returns 503 | No effect or implicit provider retry; subsequent turns can still run |
| Cancellation after the effect | Uncertain cancellation is retained; the late reply cannot revive work |
| Grant revoked before tool dispatch | No effect; the continuation receives a denied-tool receipt |

All six cases must run to pass. Watch recovery uses the production 45-second
heartbeat timeout and 10-second backoff; allow enough time and rounds to cover it.

## Long observation windows

The same runner supports up to 24 hours:

```sh
HARNESS_HEAVY_TESTS=1 SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/local-cookie \
SOAK_EXPECT_SHIP='~your-test-ship' SOAK_WORK=1 \
SOAK_DURATION_MS=86400000 SOAK_MAX_ROUNDS=256 \
node tests-js/reliability-soak.mjs
```

After the round cap, only read/idle observation continues. Limits are four
workers, 1,024 rounds, 24 hours, and 4 MiB per local model request. Unexpected
compaction fails the fixture; it never falls through to a real provider.

`--help` lists all options. `SOAK_MAX_READ_MS` adds a machine-calibrated budget for
the complete read batch. A failure stops new work; it does not retry a mutation.
`SOAK_WORKER_PID` optionally samples a specifically selected local Urbit worker's
RSS. Process-start identity is checked so PID reuse cannot silently measure a
different process. No ship restart or process signal is injected by the runner.

## Evidence and cleanup

Before connecting, the runner prints a newly created private temporary directory.
`events.jsonl` records fixture identities **before** their creation requests,
per-turn cases, probe timings and failures. `report.json` is written once at the
end with the verdict, coverage, transport counts, bounded latency summaries and
cleanup failures. Reports do not include cookies, transcripts or provider keys.
Reports identify the test source and machine, not the installed ship release.

Ctrl-C stops this Node runner, not the ship. Cleanup uses a fresh connection,
cancels only the exact fixture session identities, verifies they have no pending
inference/tools, and removes them. It never deletes other conversations or Notes.
An unavailable ship or uncertain cleanup is reported with the retained identity;
inspect it before repeating anything. Interrupted runs are not passes. If the
runner is forcibly killed, the journal remains; there may be no final report.

Latency counts, means and maxima cover the full run. Percentiles cover the most
recent 512 samples, explicitly labeled as such. Report memory is bounded; the
on-disk journal grows with the capped observation duration. HTTP/RPC wall time
includes queues and transport: **it is not a measurement of Arvo event CPU time**.
RSS is not live loom occupancy and cannot by itself establish a memory leak.

## Separate boundaries

Run deterministic runner tests with:

```sh
node --test tests-js/reliability.test.mjs
```

`/tests-integration/harness-reload` checks subscription recovery and observing
a sent Notes request without resending it. The isolated evaluation inspects
cards rather than executing them, so it does not test a real process restart.
Assertions return compact results; revalidating full card types outside the
evaluation can block the event loop.

Keep these checks distinct:

- Real process restart and cold installation, on a disposable ship.
- Cold Notes/Groups compilation and updates; a Harness soak cannot certify a
  neighboring desk's compilation performance.
- Native Notes result recovery and publication (`notes-workspace-conformance.mjs`).
- Actual browser tabs and service-worker behavior, including idle/hidden states.
- Scheduled delivery and peer/subagent settlement, covered by focused fixtures.
- Full replay scaling and live loom measurement, covered by dedicated benchmarks.

A short passing run establishes the exercised cases and duration only. It does
not establish 24-hour stability or replace the boundaries above.
