# OpenClaw Cron Observability Thin Projection Plan

> **Working agreement:** Implement on the main checkout of `lb/otel-turn-lifecycle`. Leave every change unstaged and uncommitted for review.

**Goal:** Project OpenClaw's native cron lifecycle, outcome, delivery, and job inventory signals into alert-friendly OTEL metrics and one structured terminal log without creating a competing cron span or outcome taxonomy.

**Design:** Keep `cron_changed` as the authoritative lifecycle source and OpenClaw's existing `openclaw.run` span as the authoritative execution trace. A small process-local observer tracks active runs by job ID and consumes the native `finished` event. Metric labels are restricted to bounded native dimensions; identifiers, errors, and session fields appear only in the terminal log and the existing PostHog cron event. The current plugin hook exposes diagnostic aliases rather than the exporter-created OTEL span context, so this projection intentionally does not claim per-run Tempo correlation.

**Stack:** TypeScript, OpenTelemetry metrics API, OpenClaw subsystem logging, Vitest.

---

## Task 1: Specify the OTEL projection with failing tests

**Files:**

-   Create: `packages/openclaw/src/cron-observability.test.ts`
-   Create: `packages/openclaw/src/cron-observability.ts`

1. Test native started/finished counters and duration histogram.
2. Test that metric attributes contain only bounded schedule, session-target, payload, status, and delivery dimensions.
3. Test active-run and oldest-active-run gauges with an injected clock.
4. Test active/total/schedule-kind job inventory gauges.
5. Test agent/session enrichment and the structured terminal log.
6. Test missing starts, duplicate agent hooks, provider replacement, and fail-open observer behavior.
7. Run the focused test and confirm it fails because the observer does not yet exist.

## Task 2: Implement the isolated observer

**Files:**

-   Create: `packages/openclaw/src/cron-observability.ts`

1. Define the narrow lifecycle, agent-context, and snapshot inputs.
2. Create lazy, provider-aware OTEL instruments under the `tlon.cron.*` namespace.
3. Track active runs in memory and register observable callbacks.
4. Attach isolated-session agent context to the active run without conflating agent and cron run IDs.
5. Emit one `tlon.cron.run.finished` log carrying native outcome fields, identifiers, and bounded errors.
6. Ensure every observation path is fail-open and resettable.
7. Run the focused observer tests until green.

## Task 3: Wire native lifecycle and terminal enrichment

**Files:**

-   Modify: `packages/openclaw/src/cron-telemetry.ts`
-   Modify: `packages/openclaw/src/cron-telemetry.test.ts`
-   Modify: `packages/openclaw/index.ts`
-   Modify: `packages/openclaw/src/telemetry.ts`
-   Modify: `packages/openclaw/src/telemetry.test.ts`

1. Add failing hook tests for start observation, terminal enrichment, and job inventory projection.
2. Send `started`, `finished`, and fresh job snapshots to the OTEL observer.
3. Attach agent/session context from the existing cron agent hook without depending on ContextLens.
4. Leave PostHog's native cron projection unchanged; do not publish diagnostic hook aliases as OTEL trace IDs.
5. Clear process-local cron observability state when the gateway stops.
6. Run the focused cron and telemetry tests until green.

## Task 4: Verify and review

**Files:**

-   Review every changed file; do not stage or commit.

1. Run the full OpenClaw unit suite.
2. Run TypeScript checking, lint, build, and `git diff --check`.
3. Inspect the final diff for privacy, cardinality, lifecycle ordering, and version compatibility.
4. Report verification evidence and leave the working tree unstaged.
