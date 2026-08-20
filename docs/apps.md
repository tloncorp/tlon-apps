# %apps

Structured state for app channels. An app channel is a group channel whose contents are **one opaque JSON document with a revision**, rather than a stream of posts. It exists for mini-apps whose state is not a message and which a notebook cannot hold.

%apps is a third-party channel host: `%groups` routes join/leave to it through the generic channel-host convention, and it owns the documents. It implements no UI and no data model of its own beyond the envelope — the body is opaque.

-   Types: `desk/sur/apps.hoon`. JSON: `desk/lib/apps-json.hoon`. Marks: `desk/mar/apps/{action-1,update-1}.hoon`.
-   The host contract it implements: [`docs/backend/channel-hosts.md`](backend/channel-hosts.md).
-   Client layer: `packages/api/src/client/appsApi.ts`, and `createAppChannel` in `packages/shared/src/store/channelActions.ts`.

## Purpose and shape

-   **Channels are addressed by flag** (`~ship/name`), not by nest. An app channel's kind is always `%apps`, so carrying it on the wire would be redundant; the agent rebuilds the nest where `%groups` wants one.
-   **Every document has a group.** There is no ungoverned app channel, which is what makes the permission story total: read and write both defer to that group.
-   **The body is opaque `@t` JSON.** Typing it would couple the protocol to whichever kit owns the surface. This mirrors interactive surfaces on post blobs ([`docs/tlon-apps/interactive-surfaces.md`](tlon-apps/interactive-surfaces.md)) — the same revision and idempotency semantics, with the channel as the store instead of a message.

## Poke surface (`%apps-action-1`)

-   `%create [name group title description readers writers body]` — **host only** (`our` src). Mints the document, then pokes `%groups` with a `%channel`/`%add` action carrying `readers`, which is what makes the group's `can-read` gate the channel. `join=&` on the listing, so `%groups` pokes each member's %apps as the fleet grows. Refuses a name it already holds.
-   `%write [chan id expected body]` — replace the body. See _Concurrency_ below. Accepted from a remote member, who is checked against the group. For a channel we do **not** host, this is forwarded to the host (and only our own client may ask us to forward).
-   `%delete [chan]` — **host only.** Drops the document, removes the group listing, reports the channel inactive, and kicks its subscribers.

Two more pokes come from `%groups`, not from clients — `%group-channel-join` and `%group-channel-leave`. See the host contract doc.

## Watch surface

-   `/v1/updates` — **local only.** Every `$update` for every channel this ship holds. This is what the client subscribes to.
-   `/v1/doc/<host>/<name>` — served to group members. Gated on `can-read`, so a ship the group will not admit cannot open it. Sends the current document immediately on open.

## Scry surface

-   `/x/v1/docs` — `%docs`, every channel this ship can read, keyed by flag.
-   `/x/v1/doc/<host>/<name>` — `%doc`, one document. `[~ ~]` when absent **or** when we have lost read access; the check is at access time, so a stale mirror is never served.
-   `/u/joined/<host>/<name>` — the channel-host liveness loob. See the host contract doc.

## State

```hoon
+$  state-0
  $:  %0
      docs=(map flag doc)       ::  documents we hold, hosted or mirrored
      pending=(map flag flag)   ::  joins asked but not yet answered
  ==
```

`pending` is kept out of `docs` deliberately: a channel we have asked about but not yet heard back on must not read as an empty document.

```hoon
+$  doc
  $:  group=flag       ::  the group whose membership governs this channel
      writers=(set role-id)
      revision=@ud
      body=@t          ::  opaque JSON
      applied=(list @t)
      updated=@da
  ==
```

## Concurrency

A `%write` carries two fields beyond the body:

-   **`id`** is the idempotency key. A replay of an id in `applied` is a no-op — no state change, no revision bump, **and no fact**. A client sitting in optimistic state after a double tap therefore hears nothing back and must fall back to re-reading rather than waiting.
-   **`expected`** is the revision the writer was looking at. A stale value loses: nothing changes, and the writer gets a `%conflict` carrying the revision actually stored so it can re-read instead of guessing. `~` opts into last-write-wins.

An applied write bumps `revision` by exactly 1 — except a write resolving to the stored body, which remembers its id but leaves the revision alone, so a no-change write cannot spin the revision.

`applied` is capped at `max-applied` (128) because it replicates to every subscriber on every change. Past the cap a very old retry can apply twice; the revision check catches most of that, since a stale retry usually carries a stale `expected` too.

Two concurrent writers to the same document serialize through the revision check and the loser is told to look again. That is fine for a shared household workspace. Per-record concurrency would mean a keyed collection instead of one document, and that is an additive change.

## Permissions

Neither read nor write permission lives here. Both are scried from the **local** `%groups` replica:

-   `+can-read` reads the bulk `can-read` gate at `/v2/groups/<ship>/<name>/channels/can-read/noun` and applies it to `[ship nest]`.
-   `+can-write` adds the channel's writer roles on top, matching `+can-write` in `/lib/channel-utils`: an admin or an empty writer set passes, otherwise the writer's roles must intersect the channel's.

Three details are load-bearing and are the ones to get right in any other host:

-   It must be **`%gx`, not `%gu`** — `%groups` only serves `%x` peeks.
-   The short-circuit is for the channel's **host**, deliberately **not** for `our.bowl`. On a ship mirroring someone else's channel, `our.bowl` is the local reader and must still be checked, or a member whose access was revoked keeps reading its stale mirror.
-   `+group-synced` separates a real revocation from a replication gap. A group not yet replicated cannot answer, so that reads as transient and allows; a real revocation has the group present and `can-read` false. Without this, a lagging group looks like a revocation and drops the channel.

## Lifecycle and invariants

-   A channel we host is authoritative; a channel we do not host is a mirror maintained by a subscription to the host, started on `%group-channel-join` and dropped on `%group-channel-leave`.
-   The client cannot report a created channel until the group listing has replicated. `createAppChannel` polls for it and rolls back on a definite miss — but **not** when the group could not be read at all, since the channel may well exist and deleting it would destroy a document nobody could see.
-   App channels declare a content configuration naming `tlon.r0.{input,content,collection}.app`, which no current build registers. That is deliberate: until a renderer ships, the channel degrades to the post list with the upgrade notice at the composer rather than presenting a chat composer over a document. See [`docs/tlon-apps/channel-views.md`](tlon-apps/channel-views.md).
-   No action log, snapshots, or replay. No kit-facing place declaration — a kit naming an app place needs the place vocabulary extended first.

## Tests

`desk/tests/app/apps.hoon` — 22 tests over creation and the group listing, the revision and idempotency rules, both channel-host pokes, forwarding, and the permission gate from a non-member's side. `packages/api/src/__tests__/appsApi.test.ts` and the app-channel cases in `packages/shared/src/store/channelActions.test.ts` cover the client layer.
