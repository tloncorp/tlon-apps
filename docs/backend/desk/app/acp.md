# `%acp`

`%acp` is the ship-side message bus between Tlon Messenger and an external agent worker. It is not an inference harness and does not implement Agent Client Protocol. The worker may run Codex, Claude, OpenClaw, or any other harness without changing the Gall agent.

```text
Tlon Messenger
      ↕
%activity, %chat, %channels
      ↕
%acp durable message bus
      ↕ authenticated ship connection
desktop or hosted worker
      ↕
agent harness
```

The agent owns the Tlon-specific boundary:

-   subscribing to Messenger activity;
-   applying DM and channel authorization;
-   enforcing channel mention policy;
-   normalizing messages into durable text requests;
-   deduplicating Messenger events;
-   delivering replies through `%chat` or `%channels`.

The worker owns harness execution, credentials, ACP sessions, and provider tools.

## State

The agent stores:

-   routing policy;
-   requests awaiting successful reply delivery;
-   request sequence numbers;
-   requests currently being delivered;
-   a bounded set of Messenger message keys used for deduplication.

The request queue and deduplication set are each capped at 10,000 entries. Reply text is capped at 1 MiB.

## Messenger ingress

On initialization `%acp` subscribes to `%activity` at `/v5`. It consumes DM posts, DM replies, channel posts, and channel replies. Rich Messenger stories are flattened to text with `channel-utils`.

DM requests are accepted from the configured owner or a ship in `allowed-dms`.

Channel requests must:

1. originate in a configured channel;
2. come from the owner or a ship in `allowed-channel-ships`;
3. contain a structured mention when `require-channel-mention` is enabled.

When `owner-listen` is enabled, the owner may speak without a mention in a channel hosted by the owner or bot ship.

Messages authored by the bot ship are always ignored.

## Pokes

Pokes use `%acp-action-1` and must authenticate as the local ship.

### Configure routing

```json
{
    "configure": {
        "owner": "~zod",
        "allowed-dms": ["~bus"],
        "allowed-channel-ships": ["~bus"],
        "channels": ["chat/~zod/general"],
        "require-channel-mention": true,
        "owner-listen": true
    }
}
```

Configuration is idempotent and may be sent whenever a worker connects.

### Reply

```json
{
    "reply": {
        "sequence": 42,
        "text": "Here is the answer."
    }
}
```

The referenced request remains durable until `%chat` or `%channels` acknowledges the internal delivery poke. A failed delivery keeps the request queued so a worker can retry it.

## Subscription

Subscribe to `/worker`. The initial facts contain the routing configuration and every queued request. New requests and delivery results use `%acp-update-1`.

Request:

```json
{
    "requests": [
        {
            "sequence": 42,
            "received": "~2026.07.23..17.45.00",
            "conversation": { "dm": "~zod" },
            "sender": "~zod",
            "message-id": "~zod/~2026.07.23..17.45.00",
            "text": "Can you help with this?"
        }
    ]
}
```

Channel conversations use:

```json
{
    "conversation": {
        "channel": "chat/~zod/general"
    }
}
```

Delivery results:

```json
{ "completed": { "sequence": 42 } }
```

```json
{
    "failed": {
        "sequence": 42,
        "reason": "Messenger rejected reply"
    }
}
```

Workers should suppress duplicate in-flight sequence numbers. Reconnecting is safe because queued requests are replayed.

## Scries

| Path               | Mark            | Result                |
| ------------------ | --------------- | --------------------- |
| `/x/requests`      | `%acp-update-1` | queued requests       |
| `/x/configuration` | `%acp-update-1` | routing configuration |

## Delivery semantics

Ingress is durable after `%acp` accepts the activity event. A request is removed only after Messenger accepts its reply. If a worker crashes while a request is running, the ship presents that request again on reconnect.

The harness protocol is deliberately outside Gall. ACP JSON-RPC stays between the worker and its local adapter process.
