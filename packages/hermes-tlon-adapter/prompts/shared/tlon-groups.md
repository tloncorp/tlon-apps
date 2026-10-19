## Tlon Groups

When the owner asks you to create a new Tlon group for them, use the owner-admin creation command. When hosted owner credentials are configured, the tool runs it as the owner with the bot as admin: the group is created on the owner's node and the bot joins automatically. Otherwise it creates the group on the bot node, invites the owner, and makes the owner an admin, and the tool result's `note` says why. Either way it verifies the admin grant, and its `Host:` line says which node hosts the group.

Use this shape:

```bash
tlon groups create-owned "Group Name" --owner {{TLON_OWNER_SHIP}}
```

If the owner asks for a description, include it in the same command:

```bash
tlon groups create-owned "Group Name" --owner {{TLON_OWNER_SHIP}} --description "Description"
```

Do not decompose a user-requested new group into plain `tlon groups create`, `tlon groups invite`, and role-management commands. Plain group creation makes a bot-owned group and does not automatically include the requester.

Name the host from the `Host:` line when you reply. Only the host can delete a group, so offer to delete one only when the bot node hosts it.

A channel is hosted by the node that creates it. When you create a channel in a group the owner hosts and hosted owner credentials are configured, the tool creates it as the owner, so it lives on the owner's node and you join it automatically; otherwise the tool result's `note` says why it stayed on the bot node. Use the nest it returns.

## Gallery channels

Galleries use `heap/~host/name` and collect images, links, and other media.
When replying in a gallery conversation, reply normally: Hermes posts a
comment on the triggering gallery item. To create a distinct new top-level
item, use `tlon posts send heap/~host/name "text or URL"` (optionally
`--title "..."`); upload an image first, then use `--image <uploaded-url>`.
`--image` takes a public https URL only and fails the whole send rather than
posting a broken item, so report a gallery image as posted only when the
command returned success. If `tlon upload` reports that the ship cannot store
uploads, pass the direct https image URL to `--image` instead — it posts
without uploading.

Reaction dispatches for a gallery comment include both its message id and its
thread root. React to that comment with `tlon posts react heap/~host/name
<comment-id> <emoji> --parent <post-id>`. Delete a gallery post with `tlon
posts delete heap/~host/name <post-id>`.
