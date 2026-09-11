# Bot liveness

A bot's ship publishes **whether its gateway is up** in the bot's own contact profile, so anyone who has met the bot can see when it is offline — a dimmed avatar with a corner dot, and a "Bot · Offline" badge. Sibling of [Bot info](bot-info.md), which uses the same carrier for the bot's identity claim.

No mark or protocol changes: a v1 contact is an open key-value map (`+$ contact (map @tas value)`, `desk/sur/contacts.hoon`), unknown keys pass validation and replicate to subscribers, and the client's contacts pipeline carries the key through.

## Wire format

- Contact key: `bot-liveness`.
- Value: a `%text` contact field whose text is JSON.
- Published by the bot ship's `%steward` agent (gateway module) via a `%self` contact action — a merge, so nickname/avatar/`bot-info` survive — and propagated through ordinary contact sync (`/v1/news` `%peer`/`%page` facts, `/v1/book`, `/v1/contact/{ship}`, `/v1/directory`).

```json
{ "type": "text", "value": "{\"v\":1,\"state\":\"offline\"}" }
```

| field   | type                    | notes                                                        |
| ------- | ----------------------- | ------------------------------------------------------------ |
| `v`     | `number`                | Format version. Anything other than `1` rejects the claim.   |
| `state` | `"online" \| "offline"` | Anything else rejects the claim. Unknown fields are ignored. |

Client caps at parse time (`parseBotLiveness`, `packages/shared/src/domain/botLiveness.ts`): raw text ≤ 128 UTF-8 bytes. A rejected or absent claim means **unknown** and renders nothing.

## Semantics

Steward's gateway module already tracks the harness with `%gateway-start` / heartbeats / `%gateway-stop` and a 90 s lease (see [steward.md](steward.md)). It publishes:

- `offline` on every transition to `%down` — a graceful `%gateway-stop`, or the lease-check timer expiring without a heartbeat (so detection lags a crash by up to ~90 s).
- `online` on every transition to `%up` — `%gateway-start`, or a heartbeat that revives an expired lease.

There is no debounce: a hosted model change restarts the gateway in roughly 13 s, and peers see a ~13 s offline flash. `%contacts` drops an unchanged `%self` edit before fan-out, so emitting on every transition costs one local poke.

What it cannot say: a bot **ship** that is itself down cannot update its profile, so peers keep the last value they synced (typically `online`). During a whole-pod restart of a hosted bot the ship goes down with the gateway; when it comes back the stale lease timer fires (`offline`) and the new gateway start follows (`online`).

## Audience

Whoever holds the bot as a contacts peer — the same audience as its nickname and avatar. `%channels` meets every post, reply and reaction author on receipt (`ca-heed`), so group members who have seen the bot post already subscribe to its profile. Per-channel scoping is deliberately not attempted.

## Client consumption

- Stored raw on the contact row (`contacts.bot_liveness`); validated at read.
- `domain.botLivenessOf(contact)` returns `'online' | 'offline' | null` and is `null` for any contact that is not a bot (`domain.isBotContact`).
- `ContactAvatar` dims (opacity 0.5) and draws a corner dot when the **resolved** contact (override first, then the contact index) is offline; `BotBadge` and the message author row read "Bot · Offline".
