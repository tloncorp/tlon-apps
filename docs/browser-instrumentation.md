# Hosted browser tasks and lifecycle telemetry

The plugin and Messenger emit **Browser Lifecycle** events through their existing
PostHog clients. This adds a session/handoff view above the browser service's
operation spans without changing execution or introducing a subagent. A durable
gateway-owned **BrowserTask** now holds the current monitoring state, and emits
structured OpenTelemetry log snapshots for Grafana/Loki.

## Task ownership and tools

A task represents a user's objective, not a Chrome instance. It can span multiple
sessions. Sequential tasks may reuse one session; a session with an outstanding
handoff cannot be attached to another unfinished task.

- `browser_task start`: initialize a task with a short, non-sensitive objective.
- `browser_task list/get`: inspect records scoped to the calling conversation.
- `browser_task pause/resume`: explicitly set work aside or select it again.
- `browser_task attach_session`: associate an existing `sess_` handle. Newly
  created sessions attach automatically to the task selected at tool-call start.
- `report_browser_outcome`: record an agent assessment and finish the task.

The packaged `browser-tasks` skill instructs the agent to track an objective
before browser work and report against that objective when finished. These
calls remain model-driven. Work without initialization is untracked; forgotten
outcome reports remain unknown, not successful. A handoff is not a final outcome.
Tool policy restricts these tools to owner/internal sessions, and records are
scoped to the gateway conversation key. Cross-conversation delegation is not
implemented.

States have deliberately narrow meanings:

| State | Evidence |
| --- | --- |
| `active` | Task started/resumed, or actual agent browser activity observed. |
| `waiting_for_user` | Secure handoff requested, or service observed a different subsequent form after filling. |
| `waiting_for_agent` | Service confirmed filling; no later agent browser activity observed yet. |
| `paused` | Agent explicitly set the task aside. Service receipts can still update facts. |
| `closed` | Agent reported an outcome. Session release alone never closes a task. |

Outcome is separate: `succeeded`, `partial`, `failed`, or `unknown`, attributed
to `agent`. Evidence and objective stay in the local record and are excluded
from these task snapshots. Existing OpenClaw tool-content capture policies still
apply to tool calls. Unknown with a report differs from having no report.

The single gateway process persists records by atomic file replacement at
`$OPENCLAW_STATE_DIR/tlon/browser-tasks.json` (SDK default state directory when
unset), mode 0600. It validates on load and refuses to overwrite corrupt data.
Closed records are retained for up to 30 days and pruned on writes; total capacity is
1000 tasks, pruning closed records first. Open tasks are never silently evicted. This is a single-writer store,
not a shared fleet database or a scheduler. Restarts need the same state volume.

## Service-owned handoff observations

Companion changes in `tloncorp/steel-browser` and `tloncorp/steel-mcp-server`
provide the loopback-only `GET /v1/sessions/:id/monitor-status` endpoint and the
tenant-authorized `browser_session_monitor` MCP tool. The response contains a
version, browser epoch, revision, and latest form/fill/failure metadata. It never
contains field values, labels, URLs, credentials or raw errors.

The gateway reads a baseline before sending a handoff card, then polls outstanding
handoffs every 30 seconds through its configured authenticated MCP proxy. Failed
checks back off to five minutes. This is cloud-side polling, with no client or
conversation message involved; it uses the existing proxy route rather than
introducing a callback endpoint. Missing or incompatible status leaves the last
known state with a failed/stale observation. An epoch change is missing evidence,
not a fill. Revisions at/before the baseline cannot complete a new handoff.

Service observations survive DOM navigation and expiry of the five-minute
credential-continuation receipt. They are retained in memory for the lifetime
of that browser instance, not durably across browser-service restarts or after
session release. Gateway observations are persisted once read. Polling can miss
short-lived intermediate stages before agent resumption/release; absence of a
fill observation is not proof no fill happened. The next-form fact is what the
existing app discovery requests observed, not autonomous service inference.

Exclude `browser_session_monitor` calls from existing browser-tool success/latency
panels so monitoring traffic does not inflate user-operation health statistics.

Monitoring never fills, clicks, sends a continuation, runs inference, renews a
browser lease, or keeps a session alive. The existing app-driven continuation
behavior is unchanged. A stalled task is visible but not automatically recovered.

## Grafana / Loki visibility

Each persisted update emits `log.record`, logger `tlon.browser`, body
`tlon.browser.task`, with a fixed safe projection of the current record. Every
open task also emits a heartbeat snapshot every five minutes, including after
gateway restart. Updates increment `browser_task_revision`; heartbeat snapshots
reuse that revision and advance `browser_task_observed_at`. Task age and state
age are distinct from observation freshness. Transition snapshots include the
previous state and time spent there.

The existing diagnostics-otel exporter routes these logs to Loki. Export must
be enabled and healthy; emission alone does not prove delivery. No task IDs are
metric labels. IDs live in structured log attributes and are extracted only at
query time. There is no central mutable task object in Loki.

Query recipes (select the cluster's Loki datasource; verify the OTLP JSON
envelope when deploying):

```logql
# One task's history
{service_name="openclaw-gateway", exporter="OTLP"}
| json task_id="attributes.browser_task_id", revision="attributes.browser_task_revision", state="attributes.browser_task_state", change="attributes.browser_task_change"
| task_id="TASK_UUID"

# Tasks started in the window (heartbeat/update records excluded)
sum(count_over_time({service_name="openclaw-gateway", exporter="OTLP"}
  | json change="attributes.browser_task_change" | change="started" [$__range]))

# First outcome reports, including explicitly reported unknowns
sum by (outcome) (count_over_time({service_name="openclaw-gateway", exporter="OTLP"}
  | json first="attributes.browser_task_first_outcome_report", outcome="attributes.browser_task_outcome"
  | first="true" [$__range]))
```

For a recent-state table, query **all** task snapshots over a recent window
(e.g. 15 minutes), extract task ID, revision, observed-at, state, state-since,
service-checked-at and outcome. Sort by observed-at, group by task ID, and retain
the latest row. Only then filter for waiting/active states: filtering first
would preserve an old waiting record after completion. Sort within each task
by revision as well to guard against delayed delivery of earlier records.
Show the snapshot age and service-check age; gateway heartbeat freshness does
not imply a successful service check. Use a longer history query to find stale
tasks that have dropped out of the recent window. A silent gateway disappears
from recent coverage; it must not be interpreted as zero unfinished tasks.

Task timeline, starts, reported outcomes, transition durations and recent-state
tables form the first dashboard. Reporting coverage/success ratios need a
start-time cohort, a follow-up window and distinct task IDs, not raw counts of
updates or a ratio of unrelated starts and completions in one time window.
Treat both missing initialization and missing terminal observations explicitly.
The change provides emission and recipes; it does not publish a dashboard or
change alert rules, and live ingestion requires deployment validation.

## Contract and correlation

`packages/api/src/client/browserTelemetry.ts` defines version 1 of the shared
contract. The event builder validates enums and identifiers and strips unknown
fields. No URLs, page contents, form values, field labels, credentials, or raw
errors are accepted. Existing telemetry consent/configuration still applies.

- `browserSessionId`: SHA-256 of the opaque `sess_` handle. Stable across agent
  runs/restarts; neither the handle nor the underlying Steel UUID is emitted.
  This is a plugin correlation ID, not a promise of equality with the service's
  existing `browser.session.id` span attribute.
- `browserHandoffId`: a random UUID per invocation of `browser handoff`. Internal
  lookup retries share the ID; a new handoff invocation gets a new ID.
- `browserTaskId`: optional gateway task UUID, propagated to handoff card/client
  events. It grants no authority and client events never mutate the task record.
- Agent events also carry available `sessionKey`, `sessionId`, `runId`, and
  `toolCallId`. Use the tool call ID to pair operation starts/results, including
  creation attempts that do not yet have a browser ID.
- Trusted code passes correlation through `TLON_BROWSER_TELEMETRY` to the CLI,
  then in optional A2UI navigation metadata to the app. It grants no authority.
  Older CLI binaries ignore the environment variable; older cards continue to
  work without correlation. Invalid optional metadata is ignored.

IDs are for event joins and drilldowns, never Prometheus metric labels. Count
distinct browser IDs or handoff IDs for funnels rather than raw event totals.

## Observable stages

| Phase | Evidence |
| --- | --- |
| `operation_started` | An allowed browser MCP call is about to execute. |
| `session_created` | Creation returned; count only `outcome=accepted` with a browser ID as successful creation. |
| `session_activity` | A browser operation returned. Known `browser_run` statuses are captured separately as `runStatus`. |
| `session_released` | Release returned; it says nothing about the user's task outcome. |
| `handoff_requested` | Plugin began resolving a handoff for the owner. |
| `handoff_ready` | CLI accepted sending the secure form card. It is not evidence the owner saw it. |
| `handoff_failed` | Lookup or card delivery failed, with a fixed reason code. |
| `form_opened`, `form_ready`, `form_failed` | App mounted the form screen, then loaded a supported form or failed. |
| `fill_started`, `fill_accepted`, `fill_failed` | User submitted fields; the fill endpoint accepted them or the request failed. |
| `next_form_ready`, `next_form_failed` | A login flow continued to another form or next-step discovery failed. |
| `continuation_requested`, `continuation_queued`, `continuation_failed` | A deduplicated continuation was attempted, accepted by the local message queue, or failed. Both manual and automatic continuation use this boundary. Existing receipts and concurrent duplicate attempts produce no new send event. |
| `form_closed` | An opened screen closed. Closure alone is not abandonment or success. |

`outcome` describes the observed operation (`accepted`, `failed`, `unknown`), not
whether a website action took effect. Timeouts can follow side effects.
The operation event's `taskOutcome` is explicitly **unknown** in version 1: a filled login form, a
runner's `done`, a queued continuation, and a released session cannot prove the
user's goal was satisfied. Agent-reported outcomes live on BrowserTask snapshots.

`httpStatus` is recorded for failed form HTTP requests when available; no response body or error text is emitted.

`durationMs` measures the observed request/operation where available.
Client `elapsedMs` measures time since opening that handoff, including human
entry and retries. Do not fold that human time into browser-service latency.
The gap from handoff-ready to form-opened also includes delivery and time before
the user opens the card; do not call it transport latency.

## Building the health view

Start with these cohorts over a fixed observation window:

1. Creation acceptance and p50/p95 duration, plus starts with no matching result.
2. Distinct sessions with failed operations, repeated runner `stuck`/`uncertain`
   statuses, and unusually long gaps between operations.
3. Handoff-requested → ready → opened → form-ready → fill-accepted →
   continuation-queued. Show each drop-off and fixed failure reason separately.
4. Continuations followed by another browser operation on the same browser ID.
   This is evidence of subsequent browser activity, not proof that the agent
   consumed that particular continuation. Multiple handoffs may overlap.
5. Sessions created but never observed released; handoffs opened but never
   observed filled/continued. Show their age and last observed stage.

Exclude recent, still-running cohorts from completion ratios. Separate waiting
for the owner from active processing, and report missing correlation/unknown
outcomes rather than silently dropping them. Do not alert on an unopened card
as if it were a service outage. Pair this view with service saturation, error
rates, and synthetic browser journeys.

The detailed events supplement the durable task record. Process crashes, app
termination, offline telemetry, disabled analytics, and external session expiry
can still leave an open tail. A missing terminal observation means **unknown**,
not automatically failed. No timers manufacture expiry or success.

## Rollout and validation

Deploy the browser service and MCP companion changes, then the API build,
plugin, CLI, and app through their normal release paths.
Mixed versions preserve handoff behavior but have partial funnel coverage.
This change does not modify the Grafana dashboard or provision alerts.

Unit coverage exercises response-level failures, unknown results, correlation
propagation, malformed optional metadata, privacy filtering, retries,
deduplicated continuation sends, and analytics-sink failure isolation. Validate
one real multi-step login and one details-only fill after deployment, checking
the shared IDs in PostHog and confirming that no secret values appear.
