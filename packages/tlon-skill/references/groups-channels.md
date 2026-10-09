# Workspaces, channels, and public exposure

The Tlon Messenger app calls groups **workspaces**. Use the `groups` commands for workspace operations and the word the user uses when replying. Explicit requests about the agent’s files or filesystem paths refer to its own workspace directory instead.

First discover the target using `groups list`, `groups info <group-flag>`, and `channels groups`. A group flag is `~host/group`; a channel nest is `chat/~host/channel`, `heap/~host/channel`, `notes/~host/channel`, or `buckets/~host/channel`. Use the returned IDs rather than deriving them from titles.

`groups list` shows only groups the active account belongs to. When asked for someone else’s workspaces, use their explicitly authorized configured account (`--config`) if available; otherwise state that the list covers only workspaces visible to the bot.

On accounts with a hosted Tlonbot, the app’s `New Workspace` action creates a group with the bot in it. Desktop also offers `New group`; self-hosted accounts without a hosted bot use `New group`.

## Create a workspace for a user

```json
{"command":"groups create-owned \"Project\" --owner ~requester"}
```

Use the actual requester's verified ship identity. This invites them and makes them an admin. Plain `groups create` creates a group under the current ship; it is not the default for a user-requested group. Do not report success until the owner invitation/admin step has succeeded.

Share the returned `Ref:` path in the reply so Tlon can render the group card.

## Create a channel

```json
{"command":"channels create ~host/group \"Discussion\" --kind chat --description \"Project discussion\""}
{"command":"channels create ~host/group \"Research\" --kind notes"}
```

Description is supported for chat/heap, not notes. For notebooks, continue with [notes.md](notes.md); for shared files, use [buckets.md](buckets.md). Inspect `help channels create` for kind-specific flags.

To leave a single channel, use `channels leave <nest>`; `groups leave` leaves the whole workspace and all its channels. `channels join` does not check read access: it can report "Joined" while messages remain unavailable to an account without access.

## Membership and permissions

Use `help groups` for invites, join requests, roles, and member management; inspect the specific operation before changing access. Joining a private group can request an invitation rather than immediately join it. Verify membership before claiming access.

Empty reader lists mean every group member can read. Empty writer lists mean every eligible reader can write (chat defaults to group members). Roles must already exist. Removing the last reader/writer restriction can broaden access; do not interpret an empty list as denying everyone.

`groups invite-link <group-flag>` retrieves the configured owner's invite link in OpenClaw. `--self` selects the current bot credentials instead. Do not switch identities silently to work around a permission error.

Use the returned canonical invite URL; never compose or guess one. Retrieving a link may mint it if none exists. For private/secret groups, the acting ship must be the host or an admin.

## Expose content publicly

Use `help expose` for supported targets and `expose check <nest>` to inspect status. Exposure changes public visibility; use it only for content the user asked to make public. Return the URL supplied by the command, not a fabricated link. Ordinary group access does not imply clearweb exposure.
