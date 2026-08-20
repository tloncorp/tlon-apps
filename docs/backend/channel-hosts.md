# Channel hosts

How to write a Gall agent that backs a group channel.

`%groups` does not require channels to live in `%channels`. A nest is `[kind host name]`, and for any `kind` outside `?(%chat %diary %heap)` **the kind names an agent on our own ship** that hosts that channel. `%groups` routes membership to it, and it inherits the group's permissions. Two hosts exist today: `%notes` (notebooks) and `%apps` (structured documents).

This document is the contract. It is small — three obligations and one scry you consume — but every piece of it is load-bearing, and two of them are non-obvious enough to have cost a debugging cycle each.

Source of truth: `$channel-join` / `$channel-leave` / `$channel-active` in `desk/sur/groups.hoon`; `+join-channels`, `+leave-channels`, `+is-joined`, and the `%group-channel-active` poke arm in `desk/app/groups.hoon`. Marks: `desk/mar/group/channel-{join,leave,active}.hoon`. Working examples: `desk/app/notes.hoon`, `desk/app/apps.hoon`.

## What `%groups` does for you

Once a channel with your kind is listed in a group, `%groups` maintains membership on every ship in that group. As the fleet and its permissions change it pokes **your agent on the local ship** — `[our.bowl kind]` — so every one of these is a same-ship poke and you should assert that.

## Obligation 1 — take the join and leave pokes

| mark                   | payload                            | meaning                                                       |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `%group-channel-join`  | `channel-join:g` = `[=nest =flag]` | this ship should now hold the channel, governed by that group |
| `%group-channel-leave` | `channel-leave:g` = `nest`         | this ship should stop holding it                              |

Both arrive from `+join-channels` / `+leave-channels`. Assert `=(our src):bowl`.

The nest's tail is your channel id. What you do next depends on whether you host the channel:

-   **We are the host** (`=(our.bowl host.nest)`) — a join is a no-op. You are already the source of truth for that channel; there is nothing to fetch.
-   **Someone else hosts it** — a join means start mirroring, normally by subscribing to the host's per-channel path. A leave means drop the mirror and unsubscribe.

Keep "asked but not yet answered" out of your document map. If a pending mirror lands in the same map as real state, a channel you have not synced yet reads as an empty one, and a client will happily render that as truth.

## Obligation 2 — answer the liveness scry

`%groups` asks whether you hold a channel with a **`%gu` peek** at:

```
/joined/<host>/<name>
```

Answer a loob. In an agent using the `=<` + helper-core pattern, that is an `on-peek` arm matching `[%u %joined @ @ ~]`:

```hoon
    [%u %joined @ @ ~]
  =/  chan=flag:g  [(slav %p i.t.t.path) i.t.t.t.path]
  ``loob+!>((~(has by docs) chan))
```

`+is-joined` guards on your agent's liveness first (`%gu` on `/$`) before asking, so an uninstalled host reads as not-joined rather than crashing the caller's scry. You get that for free; you do not need to do anything about it.

## Obligation 3 — report the channel active

Poke `%groups` back with mark `%group-channel-active` and payload `channel-active:g` = `[=flag =nest joined=?]` whenever a channel becomes live or stops being live for this ship. `%groups` uses it to keep `$active-channels` current. Send it on create, on delete, and when a mirror is dropped.

## What you consume — permissions

Do not invent permissions. Scry the **local** `%groups` replica and defer to it. Three things to get right:

**Use `%gx`, not `%gu`.** `%groups` only serves `%x` peeks. The bulk read gate is a **gate**, at:

```
/(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/<ship>/<name>/channels/can-read/noun
```

Scry it as `$-([ship nest] ?)` and apply it. Served by `+go-can-read`.

**Short-circuit for the channel's host, not for `our.bowl`.** This is the one that looks like a harmless optimization and is not. On a ship mirroring someone else's channel, `our.bowl` _is_ the local reader; skipping the check there means a member whose access was revoked keeps reading its stale mirror indefinitely. Only the host of a channel is unconditionally entitled to it.

**Separate a revocation from a replication gap.** A group this ship has not replicated yet cannot answer `can-read`. Check for the group first (a `%gu` peek on `/groups/<ship>/<name>`); if it is absent, treat the answer as transient and allow. A real revocation has the group present and `can-read` false. Without this split, every lag in group replication looks like a revocation and drops the channel.

For write permission, add the channel's own writer roles on top of read, matching `+can-write` in `/lib/channel-utils`: an admin passes, an empty writer set passes, otherwise the writer's roles must intersect the channel's.

Check permission **at access time**, not on a revocation watch. Then a stale mirror is never served, and you do not need to be told when access changed.

## The trap: `nest:c` pins its kind

`nest:c` in `desk/sur/channels.hoon` pins its kind to `?(%diary %heap %chat)`, and the `%channel` arm of `%groups`' own action type uses it. So **casting your nest to `a-groups:g` will not compile** even though `%groups` accepts the noun perfectly well at runtime.

This is the single non-obvious blocker in the whole contract. The fix is what `%notes` and `%apps` both do: define your own `$nest` with an unrestricted kind in your `sur/`, plus your own shapes for the `%group`/`%channel`/`%add` and `%del` actions you poke `%groups` with:

```hoon
+$  nest  [kind=@tas host=@p name=@tas]
```

## Registering the listing

A channel does not exist for `%groups` until it is listed. Poke `%groups` with `%group-action-5` carrying your `%group`/`%channel`/`%add` shape. Two fields matter:

-   **`readers`** — the group role-ids the channel is restricted to. Empty means group-wide readable. Forwarding this from the creating client is what makes the group's `can-read` gate your channel; dropping it creates every channel open.
-   **`join=&`** — so `%groups` pokes each member's copy of your agent as the fleet grows. Without it nobody but the host ever gets the join.

## Client side

-   The kind segment must be mapped in `getChannelKindFromType` and `getChannelType` (`packages/api/src/urbit/utils.ts`). Both fall through to `'chat'`, so a missing arm is silent: the channel gets a `chat/` nest and reads back as a chat channel.
-   Leave `CHANNELS_BACKED_KINDS` alone. A new kind is correctly third-party by omission, which is what `isThirdPartyChannel` keys off so `%channels`-specific affordances do not apply.
-   `channelContentConfigurationForChannelType` (`packages/shared/src/store/channelActions.ts`) throws on an unknown type, so channel creation needs an arm there.
-   Do **not** route creation through `api.createChannel`. That is the `%channels` path; your host registers its own listing.
-   The group listing is eventually consistent. A client cannot report a created channel until the listing has replicated, so poll for it — and distinguish "read the group, no listing" from "could not read the group". Only the former justifies rolling back the remote channel; rolling back on the latter destroys state nobody could see.

## Checklist

1. `sur/` with your own `$nest` and `%groups` action shapes.
2. Take `%group-channel-join` and `%group-channel-leave`, same-ship asserted, host vs mirror distinguished.
3. Answer the `%gu` `/joined/<host>/<name>` loob.
4. Poke `%group-channel-active` on every liveness change.
5. Scry `can-read` (`%gx`), short-circuit on **host**, treat an unsynced group as transient.
6. Register the listing with `readers` and `join=&`.
7. Add the agent to `desk/desk.bill` and write a spec doc under `docs/`.
8. Client: the two nest-kind arms, the content-configuration arm, and a creation path that polls for the listing.

> `%notes` is **not** in `desk/desk.bill` — no commit ever added it, so it ships in the desk unbooted. Whether that is deliberate is unclear; do not copy it.
