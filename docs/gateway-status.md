# %gateway-status

Ship-native agent for offline DM auto-replies and gateway liveness tracking. Runs on a bot ship and works with an external gateway process (e.g., the `openclaw-tlon` plugin) that reports its lifecycle via pokes.

This document describes the agent's behavior as implemented. It is not a replacement for reading the source, but it covers the protocol, state model, and lifecycle semantics needed to integrate with or modify the agent.

## overview

`%gateway-status` solves a problem that the gateway process itself cannot: responding to the owner's DMs while the gateway is down. Because no plugin code runs during downtime, the fallback responder must live on the ship.

The agent:

-   subscribes to `%activity /v4` for inbound owner DM events
-   tracks gateway liveness using a lease/heartbeat model
-   sends canned offline auto-reply DMs when the owner messages during downtime
-   sends optional restart and recovery notices around shutdown/startup transitions

The gateway process is responsible for:

-   configuring the agent on startup (`%configure`)
-   signaling start (`%gateway-start`) and stop (`%gateway-stop`)
-   sending periodic heartbeats (`%gateway-heartbeat`) to extend its lease

## state model

The agent state is `state-0`:

```
owner              (unit ship)            owner ship; ~ = unconfigured/inert
status             ?(%unknown %up %down)  gateway liveness (default %unknown)
boot-id            (unit @t)              current gateway process id (~ after graceful stop)
lease-until        (unit @da)             when the heartbeat lease expires
pending-restart-notice  ?                 whether to send back-online DM on next start
last-owner-message-at   @da               timestamp of most recent owner DM
last-owner-message-id   (unit message-key)  key of most recent owner DM
last-heartbeat-at       (unit @da)        timestamp of most recent accepted heartbeat
last-stop-at            (unit @da)        timestamp of most recent graceful stop
last-start-at           (unit @da)        timestamp of most recent gateway start
last-offline-auto-reply-at   (unit @da)   when the last auto-reply was sent
last-offline-auto-reply-to   (unit message-key)  key of DM that last triggered an auto-reply (deduplication)
active-window      @dr                    how recently owner must have messaged for notices
offline-reply-cooldown  @dr               minimum interval between offline auto-replies
```

While `owner` is `~`, the agent is inert: it subscribes to `%activity` but ignores all DM events. `%configure` is always accepted (it is how the agent leaves the inert state), but `%gateway-start`, `%gateway-heartbeat`, and `%gateway-stop` crash if owner is not set.

### boot-id lifecycle

-   Set to a new value on `%gateway-start`
-   Retained in state after crash/lease-expiry (no `%gateway-stop` was received)
-   Cleared to `~` on `%gateway-stop` (prevents delayed heartbeats from reviving the agent)

This distinction is what separates graceful-stop recovery from crash recovery.

### liveness check

The agent considers the gateway live when all three conditions hold:

-   `status` is `%up`
-   `lease-until` is set
-   `lease-until` is in the future

This is computed by `++is-gateway-live` in the structure file.

## poke protocol

All pokes use mark `%gateway-status-action-1`. All pokes must come from self (`src.bowl == our.bowl`).

### %configure

Sets the owner ship and timing parameters. Idempotent. Safe to resend on every startup.

| Field                    | Type  | Description                             |
| ------------------------ | ----- | --------------------------------------- |
| `owner`                  | `@p`  | Ship whose DMs trigger offline replies  |
| `active-window`          | `@dr` | Time window for "recently active" owner |
| `offline-reply-cooldown` | `@dr` | Minimum interval between auto-replies   |

JSON:

```json
{ "configure": { "owner": "~zod", "active-window": "~m5", "offline-reply-cooldown": "~m5" } }
```

### %gateway-start

Signals that a gateway instance has started. Requires owner to be configured (crashes otherwise).

| Field         | Type  | Description                                |
| ------------- | ----- | ------------------------------------------ |
| `boot-id`     | `@t`  | Opaque identifier for this gateway process |
| `lease-until` | `@da` | When this lease expires if not renewed     |

Effects:

-   Cancels any existing lease timer
-   Sets `status` to `%up`, stores `boot-id` and `lease-until`
-   Schedules a behn timer at `lease-until`
-   If `pending-restart-notice` is set and owner was recently active, sends the back-online DM
-   Clears `pending-restart-notice`

JSON:

```json
{ "gateway-start": { "boot-id": "abc-123", "lease-until": "~2025.4.2..23.45.06" } }
```

### %gateway-heartbeat

Extends the lease for an active gateway instance. Requires owner configured, and the `boot-id` must match the current boot-id in state. Heartbeats with a mismatched boot-id are silently ignored.

| Field         | Type  | Description                |
| ------------- | ----- | -------------------------- |
| `boot-id`     | `@t`  | Must match current boot-id |
| `lease-until` | `@da` | New lease expiry           |

Effects:

-   Cancels existing timer, schedules new timer at new `lease-until`
-   Restores `status` to `%up` (relevant after lease-expiry recovery)
-   Clears `pending-restart-notice`
-   Updates `last-heartbeat-at`

JSON:

```json
{ "gateway-heartbeat": { "boot-id": "abc-123", "lease-until": "~2025.4.2..23.46.36" } }
```

### %gateway-stop

Signals graceful shutdown. Requires owner configured, and the `boot-id` must match. Stale stops with a mismatched boot-id are silently ignored.

| Field     | Type | Description                                                                            |
| --------- | ---- | -------------------------------------------------------------------------------------- |
| `boot-id` | `@t` | Must match current boot-id                                                             |
| `reason`  | `@t` | Human-readable reason; carried in the API but does not currently affect agent behavior |

Effects:

-   Cancels lease timer
-   Sets `status` to `%down`
-   Clears `boot-id` from state (prevents delayed heartbeats from reviving the agent)
-   Sets `pending-restart-notice` to true
-   If owner was recently active, sends the restarting DM

JSON:

```json
{ "gateway-stop": { "boot-id": "abc-123", "reason": "shutdown" } }
```

## lifecycle semantics

### normal operation

```
configure → gateway-start → heartbeat (every ~s30) → gateway-stop
```

### graceful shutdown

`%gateway-stop` arrives before the process exits. The agent:

1. Transitions to `%down`
2. Clears `boot-id` (so delayed in-flight heartbeats are ignored)
3. Arms `pending-restart-notice`
4. Optionally sends the restarting DM if the owner was recently active

### crash / lease expiry

No `%gateway-stop` arrives. The behn timer fires at `lease-until`:

1. If `status` is still `%up` and the lease has expired, transitions to `%down`
2. Arms `pending-restart-notice`
3. `boot-id` remains in state (enabling heartbeat recovery)

### heartbeat recovery after lease expiry

If the gateway is still alive but its heartbeat was delayed (network, load), a valid heartbeat with the matching `boot-id` can restore `%up`. This only works after crash/lease-expiry (where `boot-id` is retained), not after graceful stop (where `boot-id` was cleared).

On heartbeat recovery:

-   `status` is restored to `%up`
-   `pending-restart-notice` is cleared (the gateway never actually went down)

### restart after downtime

When `%gateway-start` arrives with a new `boot-id`:

-   If `pending-restart-notice` is set and the owner was recently active, sends the back-online DM
-   Clears `pending-restart-notice`

## offline auto-reply

When the configured owner sends a DM (observed via `%activity /v4`) and the gateway is unavailable, the agent sends a canned reply. The reply is sent as a poke to `%chat` with mark `%chat-dm-action-2`.

Three conditions must all be true for the reply to fire:

1. **Gateway is unavailable**: `is-gateway-live` returns false
2. **Not a duplicate**: the inbound message-key differs from `last-offline-auto-reply-to`
3. **Cooldown elapsed**: time since `last-offline-auto-reply-at` exceeds `offline-reply-cooldown`

The agent ignores:

-   DMs from ships other than `owner`
-   DMs from the bot ship itself (its own outbound messages)
-   All DM events while `owner` is `~`

### canned message text

> Your Tlon bot is offline right now, so replies are paused. I'll let you know when I'm back. 🛰️

## restart and shutdown notices

### restarting notice

Sent during `%gateway-stop` if the owner was recently active:

> Your Tlon bot is restarting. I should be back shortly. 🔧

### back-online notice

Sent during `%gateway-start` if `pending-restart-notice` was armed and the owner was recently active:

> Your Tlon bot is back online and ready to chat again. ✅

### "recently active" definition

The owner is considered recently active when:

-   `last-owner-message-at` is non-zero
-   `now - last-owner-message-at` is less than `active-window`

## stale event protection

Both `%gateway-heartbeat` and `%gateway-stop` check the inbound `boot-id` against the current `boot-id` in state. Mismatches are silently ignored.

The key asymmetry:

-   **Graceful stop** clears `boot-id` → later heartbeats from the old instance fail the check → agent stays `%down`
-   **Crash/lease-expiry** retains `boot-id` → a late heartbeat from the same instance can restore `%up`

## subscriptions and scries

### watch surface

| Path  | Access                              | Description            |
| ----- | ----------------------------------- | ---------------------- |
| `/v1` | Local only (`src.bowl == our.bowl`) | Gateway status updates |

Initial fact on subscribe: `[%status status lease-until]`

Ongoing facts use the `update-1` type:

| Variant           | Fields                  | When emitted                             |
| ----------------- | ----------------------- | ---------------------------------------- |
| `%status`         | `status`, `lease-until` | After any lifecycle poke or lease expiry |
| `%owner-activity` | `last-owner-message-at` | When the owner sends a DM                |
| `%auto-reply`     | `ship`, `at`            | When an offline auto-reply is sent       |

### scry surface

All scries return `%noun` (no JSON conversion).

| Path                | Returns                 | Description              |
| ------------------- | ----------------------- | ------------------------ |
| `/x/status`         | `[status lease-until]`  | Current status and lease |
| `/x/owner-activity` | `last-owner-message-at` | Last owner DM timestamp  |
| `/x/state`          | full `state-0`          | Debugging                |

## integration with openclaw-tlon

The gateway process is expected to call the agent in this order:

1. **`configureGatewayStatus`** — on startup, before signaling start
2. **`gatewayStart`** — after the gateway process is ready
3. **`gatewayHeartbeat`** — on an interval (recommended: every 30 seconds) with a lease duration (recommended: 90 seconds)
4. **`gatewayStop`** — on graceful shutdown, with the same `boot-id`

The TypeScript helpers in `@tloncorp/api` handle temporal conversions:

-   `configureGatewayStatus` converts seconds → `@dr` strings
-   `gatewayStart` / `gatewayHeartbeat` convert Unix milliseconds → `@da` strings
-   `gatewayStop` passes `bootId` and `reason` as strings

The `boot-id` should be a unique identifier per gateway process (e.g., a UUID generated on startup).

## timing defaults

| Parameter                | Default    | Set by                              |
| ------------------------ | ---------- | ----------------------------------- |
| `active-window`          | 5 minutes  | Ship agent (via `%configure`)       |
| `offline-reply-cooldown` | 5 minutes  | Ship agent (via `%configure`)       |
| Heartbeat interval       | 30 seconds | Gateway process                     |
| Lease duration           | 90 seconds | Gateway process (via `lease-until`) |

The ship agent stores `active-window` and `offline-reply-cooldown`. The heartbeat interval and lease duration are computed by the gateway process and are not stored in agent state.
