# OpenClaw Plugin Turn Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record canonical execution, result, and delivery outcomes for every Tlon-originated OpenClaw agent turn using plugin-owned OTEL metrics and a trace-linked terminal log.

**Architecture:** A focused `turn-recorder` module owns async context, classification, and fail-open observation. The monitor opens and finalizes the context, the tool hook records model actions, and the Tlon send boundary records delivery attempts. The returned summary is projected into existing PostHog reply telemetry.

**Tech Stack:** TypeScript, Node `AsyncLocalStorage`, OpenTelemetry API, OpenClaw subsystem logging, Vitest.

## Global Constraints

-   Do not modify OpenClaw core.
-   Do not depend on ContextLens for attribution or classification.
-   Do not add cron instrumentation or collector changes.
-   Do not put session, run, user, message, error text, or tool names in metric attributes.
-   Observability failures must never change dispatch or delivery behavior.

---

### Task 1: Canonical turn recorder

**Files:**

-   Create: `packages/openclaw/src/turn-recorder.ts`
-   Test: `packages/openclaw/src/turn-recorder.test.ts`
-   Modify: `packages/openclaw/package.json`
-   Modify: `pnpm-lock.yaml`

**Interfaces:**

-   Produces:

    -   `startTlonAgentTurn(input): TlonAgentTurnHandle`
    -   `recordActiveTlonTurnSourceReply(): void`
    -   `recordActiveTlonTurnToolCall(): void`
    -   `recordActiveTlonTurnDelivery(success: boolean): void`
    -   `TlonAgentTurnSummary`

-   [x] **Step 1: Add failing classification tests**

Cover literal expected summaries for reply, action-only, reply-and-action, intentional silence, empty result, delivered, partial, failed, skipped, not-applicable, failed execution, timeout, and cancellation.

-   [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --dir packages/openclaw exec vitest run src/turn-recorder.test.ts
```

Expected: failure because `turn-recorder.ts` does not exist.

-   [x] **Step 3: Implement context and pure classification**

Create an `AsyncLocalStorage` state with reply, tool-call, delivery success, and delivery failure counters. The returned handle runs a callback in that state and finalizes once using monitor-supplied terminal facts.

-   [x] **Step 4: Verify GREEN**

Run the focused test again and expect all classification/context tests to pass.

-   [x] **Step 5: Add failing observer tests**

Use in-memory meter-provider and logger boundaries to assert exact instrument names, low-cardinality attributes, duration units, terminal log metadata, provider rebinding, and fail-open behavior.

-   [x] **Step 6: Implement OTEL and logger observer**

Use `@opentelemetry/api` and `createSubsystemLogger` from `openclaw/plugin-sdk/runtime-env`. Resolve instruments lazily from the current global provider and recreate them when the provider identity changes.

-   [x] **Step 7: Verify observer tests GREEN**

Run the focused test and expect all tests to pass.

---

### Task 2: Delivery and tool-action wiring

**Files:**

-   Modify: `packages/openclaw/src/channel.runtime.ts`
-   Modify: `packages/openclaw/src/channel.runtime.test.ts`
-   Modify: `packages/openclaw/src/monitor/index.ts`
-   Modify: `packages/openclaw/index.ts`

**Interfaces:**

-   Consumes:

    -   `observeActiveTlonTurnDelivery(callback)`
    -   `recordActiveTlonTurnToolCall()`

-   [x] **Step 1: Add failing delivery-boundary tests**

Run the channel runtime's outbound `sendText` and `sendMedia` adapters inside an active turn. Assert a successful send makes delivery `delivered` and validation, media-preparation, or poke errors make delivery `failed`, without changing the returned result or thrown error. Cover the monitor's direct-reply path through the same observer helper.

-   [x] **Step 2: Verify RED**

Run:

```bash
pnpm --dir packages/openclaw exec vitest run src/channel.runtime.test.ts src/turn-recorder.test.ts
```

Expected: the active turn still reports `not_applicable`.

-   [x] **Step 3: Instrument successful and failed Tlon sends**

Wrap each authoritative plugin-owned delivery operation. Use the outbound channel runtime adapter for message-tool sends and the monitor's direct send callback for source replies. Record one success after the operation resolves and one failure before preserving its thrown error.

-   [x] **Step 4: Record completed tool calls**

Call `recordActiveTlonTurnToolCall()` from the existing `after_tool_call` hook. The helper no-ops outside a Tlon inbound turn.

-   [x] **Step 5: Verify GREEN**

Run the focused send and turn-recorder tests.

---

### Task 3: Monitor lifecycle and PostHog projection

**Files:**

-   Modify: `packages/openclaw/src/monitor/index.ts`
-   Modify: `packages/openclaw/src/telemetry.ts`
-   Modify: `packages/openclaw/src/telemetry.test.ts`
-   Test: `packages/openclaw/src/turn-recorder.test.ts`

**Interfaces:**

-   Consumes:

    -   `startTlonAgentTurn(...)`
    -   `recordActiveTlonTurnSourceReply()`
    -   `TlonAgentTurnSummary`

-   Produces:

    -   optional `turnSummary` on `TlonReplyTelemetryResult`
    -   PostHog properties `execution`, `result`, `delivery`, `reason`, `trigger`

-   [x] **Step 1: Add a failing PostHog projection test**

Capture a reply with a literal canonical summary and assert the five new properties on the real `TlonBot Reply Handled` capture payload.

-   [x] **Step 2: Verify RED**

Run:

```bash
pnpm --dir packages/openclaw exec vitest run src/telemetry.test.ts
```

Expected: the new summary properties are absent.

-   [x] **Step 3: Wire monitor start, scope, and finalization**

Start the recorder immediately before dispatch, execute `recordTlonRouteAndDispatch` through the handle, mark a non-empty source reply before its send, and finalize in the existing `finally` block using timeout, abort, error, skip, duration, trigger, ship, account, agent, session, and run facts.

-   [x] **Step 4: Project the returned summary to PostHog**

Add optional canonical summary fields to the existing reply telemetry result and event. Preserve all current `outcome` behavior and event properties.

-   [x] **Step 5: Verify GREEN**

Run the focused recorder and telemetry tests.

---

### Task 4: Package verification

**Files:**

-   Review all files above.

-   [x] **Step 1: Format changed files**

Run Prettier only on changed plugin and documentation files.

-   [x] **Step 2: Run unit tests**

```bash
pnpm --dir packages/openclaw test
```

-   [x] **Step 3: Run TypeScript checking**

```bash
pnpm --dir packages/openclaw exec tsc --noEmit
```

-   [x] **Step 4: Run linting**

```bash
pnpm --dir packages/openclaw lint
```

-   [x] **Step 5: Run the package build**

```bash
pnpm --dir packages/openclaw build
```

-   [x] **Step 6: Inspect the final diff**

Confirm cron, collector, ContextLens semantics, and unrelated files are unchanged. Confirm no high-cardinality metric labels or sensitive content were introduced.
