# Cron

## Table of Contents
- [Introduction](#introduction)
- [Types](#types)
- [HTTP API](#http-api)
- [Body Templates](#body-templates)
- [Timer Lifecycle](#timer-lifecycle)
- [Examples](#examples)

## Introduction

`%cron` is a Gall agent that fires pokes on a repeating timer. It exposes a RESTful HTTP API at `/cron` for creating, reading, updating, and deleting scheduled poke timers.

Each timer stores a target poke specification (ship, agent, mark, body) along with a repeat interval in seconds. When the timer fires, `%cron` sends the poke to the target and reschedules itself. Failed pokes are logged but do not stop the timer.

### Source files
| File | Description |
|------|-------------|
| [`/sur/cron`](../desk/sur/cron.hoon) | Type definitions |
| [`/app/cron`](../desk/app/cron.hoon) | Agent implementation |

## Types

Defined in `/sur/cron`:

### `$poke-spec`
Target for a scheduled poke.

| Face | Type | Description |
|------|------|-------------|
| `ship` | `@p` | Target ship |
| `agent` | `term` | Target agent |
| `mark` | `term` | Poke mark |
| `body` | `@t` | Poke body (cord), supports [template substitution](#body-templates) |

### `$timer`
A scheduled poke on a repeating interval.

| Face | Type | Description |
|------|------|-------------|
| `id` | `@ud` | Auto-incrementing identifier |
| `poke` | `poke-spec` | Target poke specification |
| `cron` | `cord` | Cron expression (stored, not yet parsed for scheduling) |
| `period` | `@ud` | Repeat interval in seconds |
| `active` | `?` | Whether the timer is active |
| `created` | `time` | Creation timestamp |
| `version` | `@ud` | Monotonically increasing counter, bumped on each fire or update |

### `$timers`
`(map @ud timer)` — map of timers by sequential id.

## HTTP API

All endpoints are served under `/cron` via eyre. Request and response bodies are JSON.

### List timers

```
GET /cron
```

Returns `200` with a JSON array of all timers.

**Response:**
```json
[
  {
    "id": 0,
    "poke": {"ship": "~bus", "agent": "hood", "mark": "helm-hi", "body": ""},
    "cron": "*/10 * * * * *",
    "period": 10,
    "active": true,
    "created": "~2026.3.10..22.42.26..8361",
    "version": 5
  }
]
```

### Get timer

```
GET /cron/:id
```

Returns `200` with a single timer object, `400` if the id is invalid, or `404` if not found.

### Create timer

```
POST /cron
```

**Request body:**
```json
{
  "poke": {
    "ship": "~bus",
    "agent": "hood",
    "mark": "helm-hi",
    "body": ""
  },
  "cron": "*/10 * * * * *",
  "period": 10
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `poke.ship` | string | yes | Target ship (e.g. `"~bus"`) |
| `poke.agent` | string | yes | Target agent name (e.g. `"hood"`) |
| `poke.mark` | string | yes | Poke mark (e.g. `"helm-hi"`) |
| `poke.body` | string | no | Poke body, defaults to `""` |
| `cron` | string | yes | Cron expression (stored as metadata) |
| `period` | number | yes | Repeat interval in seconds |

Returns `201` with the created timer object. The timer starts immediately — the first poke fires after `period` seconds.

### Update timer

```
PUT /cron/:id
```

All fields are optional. Omitted fields keep their current values. The `poke` object supports partial updates — you can change just `poke.body` without resending ship/agent/mark.

**Request body:**
```json
{
  "poke": {"body": "{now}"},
  "period": 5,
  "active": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `poke.ship` | string | New target ship |
| `poke.agent` | string | New target agent |
| `poke.mark` | string | New poke mark |
| `poke.body` | string | New poke body |
| `cron` | string | New cron expression |
| `period` | number | New repeat interval in seconds |
| `active` | boolean | Enable or disable the timer |

Returns `200` with the updated timer. If the timer is active after the update, it is rescheduled with the new period. Setting `active` to `false` effectively pauses the timer — stale behn wakes are ignored via version checking.

### Delete timer

```
DELETE /cron/:id
```

Returns `204` with no body on success, `400` if the id is invalid, or `404` if not found. Any pending behn wake for this timer is silently ignored when it fires (the timer no longer exists in state).

### Error responses

All errors return a JSON object:
```json
{"error": "description of the problem"}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request (invalid id, missing fields, malformed JSON) |
| `404` | Timer not found |
| `405` | Method not allowed |

## Body Templates

The `body` field supports template substitution at fire time. Currently one token is supported:

| Token | Replacement |
|-------|-------------|
| `{now}` | Current `@da` timestamp (e.g. `~2026.3.10..23.02.24..xxxx`) |

Only the first occurrence of `{now}` is replaced. The substitution happens when the poke fires, not when the timer is created.

## Timer Lifecycle

1. **Create**: `POST /cron` stores the timer and sets a behn wake for `now + period` seconds.
2. **Fire**: When behn wakes the agent, it checks the timer is still active and the version matches (to ignore stale wakes from before an update or delete). If valid, it sends the poke to `[ship agent]` with the specified mark and body, then bumps the version and schedules the next wake.
3. **Ack handling**: Poke acks arrive on the `/fire/:id` wire. Successful acks are silently ignored. Nacks are logged via `slog` with `"cron: poke nacked"`.
4. **Update**: `PUT /cron/:id` bumps the version (invalidating any pending wake) and, if active, schedules a new wake with the updated period.
5. **Delete**: `DELETE /cron/:id` removes the timer from state. The next behn wake finds no timer and does nothing.

## Examples

### `|hi ~bus` every 10 seconds

```bash
curl -s -X POST http://localhost/cron -H 'Content-Type: application/json' -d '{"poke":{"ship":"~bus","agent":"hood","mark":"helm-hi","body":""},"cron":"*/10 * * * * *","period":10}'
```

### `|hi ~bus` with current time every 3 seconds

```bash
curl -s -X POST http://localhost/cron -H 'Content-Type: application/json' -d '{"poke":{"ship":"~bus","agent":"hood","mark":"helm-hi","body":"{now}"},"cron":"*/3 * * * * *","period":3}'
```

### Pause a timer

```bash
curl -s -X PUT http://localhost/cron/0 -H 'Content-Type: application/json' -d '{"active":false}'
```

### Resume a timer with a new interval

```bash
curl -s -X PUT http://localhost/cron/0 -H 'Content-Type: application/json' -d '{"active":true,"period":60}'
```

### Delete a timer

```bash
curl -s -X DELETE http://localhost/cron/0
```
