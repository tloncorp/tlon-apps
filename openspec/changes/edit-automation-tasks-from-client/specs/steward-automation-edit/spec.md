# steward-automation-edit Specification

## Purpose

Let the configured owner create, update, and delete a bot's automation tasks from a Tlon client. Each edit travels client → owner → bot → harness with a correlating request id and terminates in exactly one typed response, while `%steward` remains a pure relay and OpenClaw remains the only source of truth.

## ADDED Requirements

### Requirement: Edits carry a correlating request id

`%steward` SHALL accept automation edits as the `a-automation` variant `%edit [request-id bot edit]`, where `edit` is one of `create task`, `update id task`, or `delete id`, expressed with the existing automation `task` type. When the client supplies a parseable request id it SHALL be honored; otherwise `%steward` SHALL mint one from entropy and return it in every response. Each accepted edit SHALL produce exactly one terminal response keyed to its request id.

#### Scenario: Client supplies a request id

- **WHEN** a local client submits an edit with a parseable request id
- **THEN** every response for that edit carries the supplied id

#### Scenario: Client omits the request id

- **WHEN** a local client submits an edit without a request id
- **THEN** `%steward` mints one and returns it in the response envelope

#### Scenario: Update is a patch

- **WHEN** an `update` names a task id and a `task` with only some fields present
- **THEN** only the present fields are forwarded as the patch and absent fields are not invented

### Requirement: Responses are typed and terminal

A `response` SHALL be `[request-id response-body]`, and the `response-body` SHALL be one of: `created id`, `updated id`, `deleted id`, `error type message`, or `pending status`. The `action-error` type SHALL be one of `not-authorized`, `not-found`, `invalid`, `harness-offline`, `harness-error`, `unknown`. Errors SHALL be returned as data, never as a crash of the requesting poke, so the client can distinguish them. `pending` SHALL carry the poke status `sending`, `acked`, or `nacked`.

#### Scenario: Create succeeds

- **WHEN** the harness creates the task
- **THEN** the response is `created` carrying the job id the harness reports, which is the requested derived id on hosts that honor one

#### Scenario: Delete of an unknown task

- **WHEN** the harness reports that no task with the given id existed
- **THEN** the response is `error not-found`

#### Scenario: Harness rejects the command

- **WHEN** the harness's cron service throws on apply
- **THEN** the response is `error harness-error` carrying the message as its tang

### Requirement: Owner-side entry points

The owner ship's `%steward` SHALL accept edits from the local source only, through the `%edit` variant of `%steward-automation-action-1` and through `POST /steward/~/v1/automation` with body `{ requestId?, bot, action }`. Both SHALL funnel into one dispatch path. The HTTP request SHALL be gated by Eyre's authenticated-session check and SHALL be parsed defensively, returning 400 for malformed input rather than crashing.

#### Scenario: Foreign ship pokes an edit

- **WHEN** a ship other than the local ship pokes the edit mark
- **THEN** the poke is rejected and no request is recorded

#### Scenario: Unauthenticated HTTP request

- **WHEN** an HTTP `POST` arrives without an authenticated session
- **THEN** it is rejected with an authentication failure and no request is recorded

#### Scenario: Malformed HTTP body

- **WHEN** an HTTP `POST` body is not valid edit JSON
- **THEN** the response is 400 and no request is recorded

### Requirement: Held-open HTTP with pending fallback

The owner SHALL hold the HTTP `POST` open until the terminal response arrives, then complete it with the response envelope. If no terminal response arrives within 20 seconds, the owner SHALL complete the HTTP request with `pending` carrying the current poke status and SHALL keep the request record alive so a late terminal response is still stored and served.

#### Scenario: Response arrives in time

- **WHEN** the terminal response arrives before the wake
- **THEN** the held HTTP request completes with that response and the record is marked final

#### Scenario: Response is late

- **WHEN** 20 seconds elapse without a terminal response
- **THEN** the HTTP request completes with `pending` and the record remains open

#### Scenario: Late response after pending

- **WHEN** a terminal response arrives after the HTTP request was completed as pending
- **THEN** the record is finalized and the result is available by `GET` and on the per-request path, and the HTTP request is not completed a second time

### Requirement: Late pickup by request id

The owner SHALL serve `GET /steward/~/v1/automation/request/<uv>` returning the current record and marking it fetched, gated identically to the `POST`. The owner SHALL expose a local-only watch path `/v1/automation/request/<uv>` that gives the terminal response as a fact and replays a stored terminal result at subscribe time.

#### Scenario: Subscribe after finalization

- **WHEN** a local client subscribes to the per-request path after the result was stored
- **THEN** it immediately receives the stored terminal response

#### Scenario: Unknown request id

- **WHEN** a `GET` names a request id with no record
- **THEN** the response is 404

### Requirement: Owner relays to the bot watch-first

For each accepted edit the owner SHALL subscribe to the bot's `/v1/automation/request/<owner>/<uv>` before poking `c-automation` `%edit [request-id edit]` under `%steward-automation-command-1` to the bot, and SHALL arm the pending wake. A watch nack SHALL finalize `error not-authorized`; a poke nack SHALL finalize `error unknown`; a poke ack SHALL record status `acked`. On receiving the response fact the owner SHALL finalize the request and leave the bot watch. The owner SHALL always poke the bot, including when the bot is the owner's own ship.

#### Scenario: Bot rejects the watch

- **WHEN** the bot nacks the per-request watch
- **THEN** the owner finalizes `error not-authorized` and does not poke the command

#### Scenario: Command poke is nacked

- **WHEN** the bot nacks the command poke
- **THEN** the owner finalizes `error unknown`

#### Scenario: Response fact arrives

- **WHEN** the bot gives the response fact on the per-request path
- **THEN** the owner finalizes with that body and leaves the watch

### Requirement: Bot-side authorization

The bot SHALL admit the per-request watch only when the subscribing ship equals the requester named in the path and is the configured owner, SHALL admit `%steward-automation-command-1` only from the configured owner, and SHALL admit the `a-automation` `%finalize` variant and the harness feed only from the local source. Unauthorized attempts SHALL be rejected without recording or forwarding anything.

#### Scenario: Owner submits a command

- **WHEN** the configured owner pokes a command
- **THEN** it is recorded and forwarded

#### Scenario: Unrelated ship submits a command

- **WHEN** a ship that is not the configured owner pokes a command
- **THEN** the poke is rejected and nothing is recorded

#### Scenario: Unrelated ship subscribes to the harness feed

- **WHEN** a ship other than the local ship subscribes to `/v1/automation/harness`
- **THEN** the watch is rejected

### Requirement: Bot forwards to the harness with a presence check

On an accepted command the bot SHALL check for a live local subscriber on `/v1/automation/harness`. With none, it SHALL finalize `error harness-offline` immediately. With one, it SHALL record the pending command with its requester and time and give it as a `dispatch` fact on the harness feed. On a `%finalize` for a pending id it SHALL give the `response` under `%steward-automation-response-1` on the requester's per-request path and drop the record, however long the command has been pending. A `%finalize` naming an id with no pending record SHALL be ignored. The bot SHALL NOT arm a deadline on a pending command and SHALL NOT modify its automation task map for any edit.

#### Scenario: No harness is subscribed

- **WHEN** a command is accepted while nothing subscribes to the harness feed
- **THEN** the bot finalizes `error harness-offline` at once

#### Scenario: Harness responds

- **WHEN** the harness pokes a response for a pending id
- **THEN** the bot gives it on the requester's per-request path and drops the record

#### Scenario: Harness responds after the owner's pending wake

- **WHEN** the harness pokes `%finalize` for a command pending longer than 20 seconds
- **THEN** the bot gives it on the per-request path like any other response, and the owner finalizes its record for pickup by id

#### Scenario: Response for an unknown id

- **WHEN** a `%finalize` names an id with no pending record
- **THEN** it is ignored and no fact is given

#### Scenario: Task map is untouched

- **WHEN** any edit is accepted, forwarded, or finalized
- **THEN** the bot's stored automation task map is unchanged

### Requirement: Harness feed replays outstanding commands

On subscribe to `/v1/automation/harness` the bot SHALL give one fact per outstanding pending command, as `dispatch` facts under `%steward-automation-dispatch-1`, so a restarted harness resumes in-flight work. Thereafter it SHALL give one fact per newly accepted command.

#### Scenario: Harness restarts mid-flight

- **WHEN** the plugin subscribes while commands are pending
- **THEN** it receives each pending command once

#### Scenario: No commands are pending

- **WHEN** the plugin subscribes with nothing pending
- **THEN** it receives no initial facts

### Requirement: Plugin applies commands through the cron service

At `gateway_start`, when exactly one Tlon account is runnable, the plugin SHALL subscribe to the bot's harness feed and SHALL hold the cron service from `getCron()`. For each command it SHALL validate the input, map it to the service's create, patch, or remove input, apply it, and poke the `a-automation` `%finalize` variant with the typed `response-body`. Commands for one bot SHALL be applied serially. `create` SHALL require the fields the service requires and otherwise respond `error invalid` without calling the service. `create` SHALL request a job id derived deterministically from the request id, SHALL report the id the service actually assigned, and SHALL answer a duplicate-id rejection from the service as `created` with the derived id so replayed creates are idempotent on hosts that honor a requested id. `remove` reporting no removal SHALL respond `error not-found`. A thrown service error SHALL respond `error harness-error`. `gateway_stop` SHALL end the subscription without affecting Steward state. With zero or several runnable accounts the plugin SHALL NOT subscribe.

#### Scenario: Create with a cron schedule

- **WHEN** a create command carries a cron-expression schedule, a payload, session target, and wake mode
- **THEN** the plugin calls the service's `add` and responds `created` with the returned job id

#### Scenario: Create with an `at` schedule

- **WHEN** a create command carries an `at` timestamp in integer milliseconds
- **THEN** the plugin converts it to ISO text before calling `add`

#### Scenario: Create missing required fields

- **WHEN** a create command lacks a field the service requires
- **THEN** the plugin responds `error invalid` and does not call the service

#### Scenario: Create is replayed

- **WHEN** a create command is replayed after the plugin applied it without responding
- **THEN** the service rejects the duplicate id and the plugin responds `created` with the same id, and no second job exists

#### Scenario: Update patches a task

- **WHEN** an update command carries a task id and present fields
- **THEN** the plugin calls `update` with only those fields and responds `updated`

#### Scenario: Multiple accounts are runnable

- **WHEN** more than one Tlon account is runnable
- **THEN** the plugin does not subscribe to the harness feed

### Requirement: Request records are bounded

Both owner and bot SHALL timestamp request records and SHALL run a periodic sweep that evicts terminal records after a grace window, immediately once fetched, and evicts a record still awaiting its terminal response only after a long pending window on the order of an hour.

#### Scenario: Fetched record is evicted

- **WHEN** a terminal record has been fetched and the sweep runs
- **THEN** the record is removed

#### Scenario: Open record survives the sweep

- **WHEN** a record has no terminal result and the pending window has not passed
- **THEN** the sweep leaves it in place

### Requirement: Mirror read over HTTP

The owner SHALL serve `GET /steward/~/v1/automation/tasks` returning the same JSON as the `/x/v1/automation/tasks` scry, gated by Eyre's authenticated-session check.

#### Scenario: Mirror is read

- **WHEN** an authenticated client requests the tasks route
- **THEN** it receives the ship-keyed task map JSON

### Requirement: API client distinguishes envelopes

The api package SHALL provide create, update, and delete functions that post the edit, return on `created`/`updated`/`deleted`, throw a typed error carrying the error type and message on `error`, and throw a typed pending error carrying the request id and poke status on `pending`. It SHALL provide a request-pickup function by id and a mirror read.

#### Scenario: Server returns a typed error

- **WHEN** the envelope body type is `error`
- **THEN** the client throws an error exposing the error type and message

#### Scenario: Server returns pending

- **WHEN** the envelope body type is `pending`
- **THEN** the client throws a pending error exposing the request id and status
