# OpenClaw Plugin Turn Recorder Design

## Scope

Add a stopgap, plugin-owned recorder for agent turns initiated by the Tlon channel. The recorder must produce alert-friendly OpenTelemetry metrics and a trace-linked terminal log without modifying OpenClaw core or depending on ContextLens.

This change does not instrument cron runs and does not change the hosted collector. Those remain separate follow-ups.

## Selected approach

Use a Tlon-owned `AsyncLocalStorage` context around the existing inbound dispatch callback. The context records facts that occur anywhere in the dispatch's asynchronous call tree:

-   a source reply was produced;
-   a tool call completed;
-   a Tlon delivery succeeded or failed.

The monitor retains a handle to the context and finalizes it in the dispatch `finally` block with facts already available there, including timeout, cancellation, dispatch errors, skip reason, duration, destination kind, and trigger.

This approach is preferred to session-key maps because it isolates concurrent turns naturally and does not require high-cardinality lookup state. It is preferred to reconstructing outcomes from diagnostic events because the plugin already owns the authoritative Tlon delivery boundary.

## Canonical outcome

Each terminal turn has three independent outcome dimensions:

-   `execution`: `completed`, `failed`, `timed_out`, `cancelled`, or `abandoned`;
-   `result`: `reply`, `action_only`, `reply_and_action`, `intentional_silence`, or `empty`;
-   `delivery`: `delivered`, `partial`, `failed`, `skipped`, or `not_applicable`.

It also has a bounded `reason` chosen from code-owned constants. Error text, message text, session IDs, run IDs, and user identity never become metric attributes.

Result classification treats any completed model-initiated tool call as an action. A non-empty source reply marks a reply. A dispatcher skip of `silent` or `heartbeat` marks intentional silence when neither a reply nor an action was recorded. Other no-result turns are empty.

Delivery classification counts successful and failed Tlon message sends in the active turn. Mixed success and failure is partial. A produced reply with no delivery attempt is skipped. Turns without a reply or Tlon message delivery are not applicable.

## Signals

The recorder emits:

-   counter `tlon.agent.turns.started`;
-   counter `tlon.agent.turns`, carrying terminal outcome attributes;
-   histogram `tlon.agent.turn.duration`, in seconds;
-   structured info log with body `tlon.agent_turn.terminal`.

Metric attributes are limited to:

-   `execution`, `result`, `delivery`, `reason`;
-   `trigger`, `destination_kind`;
-   normalized bot `ship`;
-   configured `account_id` and `agent_id`.

The terminal log carries those fields plus `run_id`, `session_key`, duration, reply/tool/delivery counts, and a fixed event name. OpenClaw's subsystem logger adds the active trusted diagnostic trace context, allowing diagnostics-otel to export the record with the current trace ID.

The OpenTelemetry meter is resolved lazily and rebound whenever the global meter provider changes. This avoids permanently retaining a no-op meter if the channel starts before diagnostics-otel registers the SDK.

## Existing PostHog projection

The recorder returns the exact canonical summary to the monitor. When existing Tlon product telemetry is enabled, the monitor passes the summary into the existing `TlonBot Reply Handled` event as `execution`, `result`, `delivery`, `reason`, and `trigger`. OTEL recording is independent of PostHog enablement.

## Failure handling

Observability must never affect message processing or delivery:

-   metric and log emission are wrapped and swallowed at the recorder boundary;
-   late callbacks after finalization are ignored;
-   finalization is idempotent;
-   recorder state contains no message or tool payloads;
-   abrupt process death is detected operationally as divergence between started and terminal counters rather than by an in-process timeout.

## Verification

Unit tests cover:

-   every result, delivery, and execution branch;
-   async propagation and concurrent-turn isolation;
-   idempotent finalization and ignored late writes;
-   lazy meter-provider rebinding;
-   structured terminal log fields;
-   successful and failed outbound Tlon sends updating the active turn;
-   the canonical summary appearing on the existing PostHog reply event.

Package tests, TypeScript checking, linting, formatting checks, and the package build must pass before completion.
