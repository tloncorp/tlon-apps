# Conversation hands

A hand connects a chat or service to a Harness conversation. It submits inputs
and delivers answers through native Gall nouns or the `harness/hand` ACP method.
The head runs the conversation; the hand authenticates external actors and
handles delivery.

The `publish` capability covers text input and terminal replies. Provider and
tool execution use separate protocols.

```text
surface event → binding → durable observation queue → session head
                                                        ↓
surface message ← hand ← claim + receipt ← publication outbox
```

Acceptance, inference, and publication are separate facts. Losing a connection
does not cancel the work; failing to publish does not run the model again.

Hands also support [scheduled work](scheduling.md), managed in Settings → Schedules.

## Binding and authority

A binding has an immutable id, hand id, opaque destination address, session id,
an explicit actor allowlist, and an enabled flag. Create and configure the
session first. Its model, instructions, and execution-time tool grants govern
the work. New sessions inherit global defaults, **including enabled tools**:
narrow these before accepting input from an external channel.

Use one session per conversation. Binding two surfaces to one session shares
their model context: an answer on either can draw on the other's history.

Adapters have owner authority through same-ship native calls or authenticated ACP.
Hand and worker IDs are labels, not credentials. The adapter must authenticate
actors, exclude its own messages, and enforce membership and mention rules.
Keep ship login codes private; remote ships use the [peer interface](peers.md).

Binding identity and actor grants are immutable; use a new binding id to change
them. Enable/disable is separate. Disabling stops new observations, queued
admissions, and new delivery claims. It does not cancel an active turn or undo
a publication already claimed. Receipts can still reconcile it.

## ACP

Call `harness/hand` over ACP directly or use the JavaScript helper below.

Initialize an ordinary ACP connection. The response advertises
`_meta["harness/hand"] = {version: 2, capabilities: ["publish"]}`.
Send actions as the params of `harness/hand`:

```json
{"jsonrpc":"2.0","id":1,"method":"harness/hand","params":{"bind":{"id":"support-chat","config":{"hand":"chat-adapter","address":"opaque-channel-and-thread","sessionId":"support","actors":["alice"],"enabled":true}}}}
{"jsonrpc":"2.0","id":2,"method":"harness/hand","params":{"observe":{"binding":"support-chat","event":"source-message-17","actor":"alice","text":"What can you help me with?"}}}}
{"jsonrpc":"2.0","id":3,"method":"harness/hand","params":{"outbox":{"hand":"chat-adapter"}}}
```

The dependency-free helper accepts any initialized client implementing
`call(method, params)`, including a browser client or a JSON-RPC client over
the stdio bridge:

```js
import { HandClient } from './acp/hand-client.mjs'

const hand = new HandClient(acp, {
  hand: 'chat-adapter', worker: 'chat-worker-1',
})
const { sessionId } = await acp.call('session/new', { name: 'support' })
const config = await acp.call('harness/session/config', { sessionId })
await acp.call('harness/session/configure', {
  sessionId, config: { ...config, key: '', tools: [{ clay: '/harness/lib' }] },
})
const { binding } = await hand.register({
  address: 'opaque-channel-and-thread', sessionId, actors: ['alice'],
})
await hand.observe(binding, {
  event: authenticatedMessage.id,
  actor: authenticatedMessage.author,
  text: authenticatedMessage.text,
})

// Separately, in a delivery worker:
for (const intent of await hand.outbox()) {
  if (intent.status !== 'pending') continue // reconcile existing claims
  await hand.deliver(intent.effectId, async (claimed) => {
    const sent = await publish(claimed.address, claimed.text, claimed.effectId)
    return sent.id
  })
}
```

`publish` and `authenticatedMessage` belong to the adapter. Use `effectId` as
the destination's idempotency key when supported. Throw the helper's exported
`DeliveryNotSent` only when certain no external message was created. A timeout
is not that evidence.

| Action | Parameters | Result |
|---|---|---|
| `bind` | `id`, `config` as above | Binding status |
| `register` | `config` | Binding status with a ship-allocated, never-reused id |
| `enable` | `id`, `enabled` | Binding status |
| `remove` | `id` | Empty object; only for bindings with no observations |
| `observe` | `binding`, `event`, `actor`, `text` | `inputId`, `phase`, `sourceEvent` |
| `status` | `binding` | Binding and observation statuses |
| `outbox` | `hand` | Undelivered publications for enabled bindings |
| `publications` | `hand`, `after` (id or null), `limit` | Bounded `records` and `next` cursor |
| `effect` | `hand`, `effect` | Publication, including terminal receipts |
| `claim` | `hand`, `effect`, `worker` | Publication plus `acquired` and `attempt` |
| `receipt-at` | `hand`, `effect`, `worker`, `attempt`, `status`, `external` | Updated publication; rejects stale attempts |
| `retry` | `hand`, `effect` | Confirmed failed publication reset to pending |
| `resolve` | `hand`, `effect`, `attempt`, `status`, `external`, `reason` | Owner disposition, fenced attempt, audit entry |
| `health` | `hand` | Claimed/uncertain work with ages, queue usage and limits |
| `archive` | `binding` | Disabled, settled binding's snapshot digest and record count |
| `records` | `binding`, `after` (id or null), `limit` | Export page, snapshot digest and `next` cursor |
| `retire` | `binding`, `digest`, `location` | Release exported operational records; retain session |

`effect` is the returned `effectId` string in Urbit `0v…` notation. The helper
supplies its hand/worker ids and defaults `external` to the empty string.
Pages clamp `limit` to 1–4; the helper defaults to one and `outbox()` follows
pages. Numeric id ordering is for traversal, not chronological delivery. A
changing outbox is not a frozen snapshot: start another pass to discover new
effects whose ids sort before a cursor. Use `receipt-at` with the
attempt returned by the claim. The attempt-free `receipt` action is restricted
to the first claim generation.

## Admission and recovery

The pair `(binding, source event id)` determines `inputId`. Repeating an
identical observation returns its status; changing its actor or text is an
error. Use the source's durable message id, not a fresh UUID on each retry.
Message edits require a new event id. This idempotency is independent of ACP
transport sequence numbers and ordinary prompt `clientMessageId`.

Observations queue durably before inference. Admission returns promptly;
status progresses through `queued`, `running`, and `completed`, `failed`, or
`cancelled`. Turns serialize within a session and proceed independently across
sessions. A queued turn sees preceding completed context. Native sends cannot
splice input into an active hand turn; timer wakes wait for it. Webhooks cannot
write bound sessions: use the authenticated hand protocol and its actor checks.

Use `status` for admission recovery and `outbox` for delivery work. Inspect
native snapshots or `harness/session/snapshot` for progress and diagnostics.
No client connection owns the run. `session/cancel` cancels both the active turn
and queued observations for that session. Queued cancellations appear in status
without creating a reply; active cancellations produce a cancellation publication.

Native hands watch `%harness` at `/hand-events` for `%noun` `%changed` facts.
Read the ledger on each notification; facts contain no transcript or provider
data. Subscription sends an initial fact, allowing recovery after disconnection.
Re-subscribe after a kick. Status reads emit no notification. Tlon uses this
watch rather than polling publications.

Publications carry `version`, `effectId`, `inputId`, `binding`, `hand`, `address`,
`sessionId`, `capability`, `kind`, `text`, `status`, `worker`, `externalId`, and
`attempt`, chronological `receipts`, and owner `resolutions`. One terminal publication is created per executed
observation, with `effectId = inputId`. Kinds are `reply`, `failure`, or
`cancelled`. Failures expose a generic message, not internal diagnostics.

The outbox is unordered. For chat delivery, match `inputId` to chronological
session entries and send one publication at a time per destination. Adapters
handle cross-surface ordering, edits, and reactions.

## Claims and receipts

```text
pending → claimed → delivered
                  → failed → explicit retry → pending
                  → uncertain → reconcile → delivered or failed
```

Only the first claim returns `acquired: true`; the same worker's repeat returns
false, and another worker is rejected. Send only after acquiring a claim.
Use stable worker IDs and reconcile abandoned claims after restart.
Keep the attempt returned by that particular claim through its entire external
operation. The helper does this even if another operation updates its cache.
After reconnecting, inspect `effect` and pass its attempt explicitly to
`receipt(effectId, status, externalId, attempt)`.

Successful publication records an external message id. Repeating an identical
receipt is safe; conflicting terminal receipts are rejected. Delivery failure
and retry append receipt history without modifying the transcript or rerunning
inference. `uncertain` blocks retry until the claiming worker establishes
whether the destination accepted the message. There is no automatic claim
expiry: elapsed time alone cannot establish non-delivery.

If the worker cannot return, the owner can `resolve` the current attempt to
`uncertain`, `failed`, `delivered`, or `abandoned`, with an explicit reason.
Resolution advances the attempt and clears the worker; receipts from the old
attempt are rejected, even if the replacement uses the same worker name.
Use `failed` only after confirming non-delivery. `abandoned` means intentionally
not pursuing delivery, not proof that an external message never appeared. It
is terminal, disappears from the work outbox, and remains in the export audit.

`health` flags claims or uncertain outcomes older than five minutes for
inspection. It never expires or resends them. A generation fence protects
ship-side receipts, **not an already running external send**. Stop or reconcile
that worker before authorizing a replacement. Owner credentials still grant
all these administrative actions; worker strings do not authenticate them.

This is not a cross-system exactly-once guarantee. Use destination idempotency
keys or lookups to close the external-send/receipt gap. If a delivered receipt
is lost in transit, repeat that receipt or inspect `effect`; do not republish.

## Fair admission and explicit retention

Waiting work is limited to 8 observations per binding, 16 per session across
its bindings, and 128 globally. One stalled conversation cannot consume the
whole waiting queue. Duplicate admissions are checked before capacity limits,
so retrying an already admitted event still recovers its identity.

The ledger allows 256 observations per binding, 2,048 globally, and 256 active
bindings. Text is limited to 65,536 bytes and source IDs to 512 bytes; metadata
and recovery histories also have admission limits. Full capacity rejects work
without deleting records or pruning session history.

Rotate a binding epoch before it fills:

1. Stop consuming new source events and disable that binding.
2. Settle or cancel its queued/running work. Reconcile every publication to
   `delivered` or explicitly `abandoned`.
3. Export its descriptor and all `records` pages, checking the digest and
   count. Persist that archive, then `retire` with its digest and location.
4. `register` another binding to the **same session** and resume at the
   adapter's saved source cursor. Its conversation memory is unchanged.

Never relabel old source events with the new binding: deduplication is scoped
to the binding epoch. Retired binding ids reject all further observations.
Ship-allocated `hand--…` ids use a monotonic counter instead of an ever-growing
tombstone set. Manually named ids remain available, but their combined active
and retired identity capacity is 4,096; use `register` for continuous rotation.

The owner-side command performs the export-before-release sequence:

```sh
SHIP_COOKIE=/path/to/auth-cookie.txt \
  node tests-js/archive-hand.mjs BINDING /safe/archive/binding.jsonl
```

It requires a disabled, settled binding, creates a private file without
overwriting anything, writes a completion footer, and fsyncs both file and
directory before retirement. Partial exports remain on disk for inspection;
they do not authorize retirement. A completed archive is sensitive: it contains
source text and publication/receipt history. Choose durable storage and backups;
`/tmp` is appropriate only for test fixtures.

The digest is a ship-side snapshot compare-and-set token, not a checksum of
the JSONL encoding. The ship cannot prove a remote archive was persisted: the
trusted owner attests that through `location`. Retirement removes only this
binding's duplicated admission/delivery records and binding config; it neither
deletes nor reruns the session. The latest 128 retirement receipts remain on
ship; identical retries within that window are idempotent. Remove unused
bindings or export/retire used bindings before renaming/deleting their session.

## Native nouns

Import `hh=harness-hand` from `/sur`, then poke `%harness` with mark
`%harness-hand` and a `request:hh`:

```hoon
['request-17' %observe 'support-chat' 'source-message-17' 'alice' 'Hello']
```

Watch `/hands/request-17` before the poke. Its `%noun` fact is
`(each json @t)`, sharing ACP's result/error semantics. Use distinct request ids
for concurrent requests, unwatch after the result, and recover through scries
when a response is lost. A successful poke ack alone is not admission success.

- `/x/hands/<binding>`: binding/observation JSON status.
- `/x/hand-outbox/<hand>`: publication JSON outbox.
- `/x/hand-state`: owner-only typed bookkeeping state.

Eyre projects the JSON scries at `/~/scry/harness/hands/<binding>.json` and
`/~/scry/harness/hand-outbox/<hand>.json`. Both transports call the same pure
gates in `desk/lib/harness-hand.hoon`.

## Adapter scope

The [Tlon hand](tlon.md) maps authenticated activity to `observe`, encodes the
channel/thread as an opaque address, and implements `publish`. Its DM/channel
protocols and social permissions stay in `%harness-tlon`, outside the head.

The head retains bindings, queues, and outboxes across reloads. The hand
protocol supplies neither supervision, per-worker credentials, nor per-binding
model budgets.
