# Workspaces, channels, and public exposure

The Tlon Messenger app calls groups **workspaces**. Use the `groups` commands for workspace operations and the word the user uses when replying. Explicit requests about the agent’s files or filesystem paths refer to its own workspace directory instead.

First discover the target using `groups list`, `groups info <group-flag>`, and `channels groups`. A group flag is `~host/group`; a channel nest is `chat/~host/channel`, `heap/~host/channel`, `notes/~host/channel`, or `buckets/~host/channel`. Use the returned IDs rather than deriving them from titles.

`groups list` shows only groups the active account belongs to. When asked for someone else’s workspaces, use their explicitly authorized configured account (`--config`) if available; otherwise state that the list covers only workspaces visible to the bot.

On accounts with a hosted Tlonbot, the app’s `New Workspace` action creates a group with the bot in it. Desktop also offers `New group`; self-hosted accounts without a hosted bot use `New group`.

## Create a workspace for a user

```json
{"command":"groups create-owned \"Project\" --admin ~requester"}
```

`create-owned` makes a group hosted by the ship that runs it and makes the `--admin` ship its admin (`--owner` is a legacy alias for `--admin`). Use the actual requester's verified ship identity. Plain `groups create` gives the group no admin besides its host; it is not the default for a user-requested group. Do not report success until the admin step has succeeded. If it fails after the group exists, the error names the group and its host: do not create it again. If you are the host, finish with the `groups promote` it suggests; otherwise ask the host to make the admin an admin in the app.

When the requester is your owner and the runtime holds the owner's hosted credentials, the tool runs this as the owner with you as the admin: the owner's ship hosts the workspace, and you join automatically. Otherwise your own ship hosts it and the tool result says why. The output's `Host:` line says which; name the host when you reply. A workspace hosted by your owner appears in your `groups list` once you have joined it.

Share the returned `Ref:` path in the reply so Tlon can render the group card.

## Create a channel

```json
{"command":"channels create ~host/group \"Discussion\" --kind chat --description \"Project discussion\""}
{"command":"channels create ~host/group \"Research\" --kind notes"}
```

The output gives the new channel's `Nest:` and its group's `Ref:`. Channels have no card yet: in your reply, name the channel, give its nest, and share the group `Ref:` path.

Description is supported for chat/heap, not notes. For notebooks, continue with [notes.md](notes.md); for shared files, use [buckets.md](buckets.md). Inspect `help channels create` for kind-specific flags.

A channel is hosted by the ship that creates it. In a group your owner hosts, when the runtime holds the owner's hosted credentials, the tool creates the channel as the owner, so it lives on the owner's node and you join it automatically; otherwise it stays on your ship and the tool result says why. Use the nest it returns, whose host part names the host.

To leave a single channel, use `channels leave <nest>`; `groups leave` leaves the whole workspace and all its channels. `channels join` does not check read access: it can report "Joined" while messages remain unavailable to an account without access.

## Sections and channel order

Read section ids, titles and 0-based channel positions from `groups info <group-flag>` first; commands accept a section id or its title. All section commands are admin only and refuse up front otherwise.

```json
{"command":"groups add-section ~host/group \"Archive\""}
{"command":"groups move-channel ~host/group chat/~host/general --section Archive --index 0"}
```

`add-section` puts the new section at the bottom; `rename-section <group-flag> <section> "<new title>"` changes only its title. `move-channel --index N` is the channel's final 0-based position; without it, the channel goes to the end of the section, unless it is already assigned to and listed in that section, in which case nothing changes. `order-sections` must list every section exactly once, `default` included. The `default` section cannot be deleted; `delete-section` first moves the section's channels to the top of `default`, keeping their order. Multi-step commands check each step but are not atomic: on a partial failure, follow the printed recovery instructions exactly, and do not re-run `add-section` unless told to.

## Membership and permissions

Use `help groups` for invites, join requests, roles, and member management; inspect the specific operation before changing access. Joining a private group can request an invitation rather than immediately join it. Verify membership before claiming access.

`groups join --invite <url|token>` redeems an invite link (`https://invite.tlon.io/0v…`, `join.tlon.io/…`, `tlon.network/lure/…`) or a bare `0v…` token. Pass the link as given; do not fetch or open it. A personal invite adds the inviter as a contact and joins nothing. A private or secret group can come back as "requested" or "unconfirmed" rather than joined; verify with `groups list` before claiming access. An unconfirmed invite is accepted later, once it arrives, by running the same `groups join --invite` command again, unchanged (keep `--self` if you used it). In OpenClaw, `groups join --invite` redeems for the configured owner; `--self` redeems it for your own account. A plain `groups join <group-flag>` always runs as you.

Empty reader lists mean every group member can read. Empty writer lists mean every eligible reader can write (chat defaults to group members). Roles must already exist. Removing the last reader/writer restriction can broaden access; do not interpret an empty list as denying everyone.

`groups invite-link <group-flag>` retrieves the configured owner's invite link in OpenClaw. `--self` selects the current bot credentials instead. Do not switch identities silently to work around a permission error.

Use the returned canonical invite URL; never compose or guess one. Retrieving a link may mint it if none exists. For private/secret groups, the acting ship must be the host or an admin.

## Expose content publicly

Use `help expose` for supported targets and `expose check <nest>` to inspect status. Exposure changes public visibility; use it only for content the user asked to make public. Return the URL supplied by the command, not a fabricated link. Ordinary group access does not imply clearweb exposure.
