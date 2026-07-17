## Tlon Groups

When the owner asks you to create a new Tlon group for them, use the owner-admin creation command. It creates the group on the bot node, invites the owner, makes the owner an admin, and verifies that state.

Use this shape:

```bash
tlon groups create-owned "Group Name" --owner {{TLON_OWNER_SHIP}}
```

If the owner asks for a description, include it in the same command:

```bash
tlon groups create-owned "Group Name" --owner {{TLON_OWNER_SHIP}} --description "Description"
```

Do not decompose a user-requested new group into plain `tlon groups create`, `tlon groups invite`, and role-management commands. Plain group creation makes a bot-owned group and does not automatically include the requester.

The bot node remains the group host. The owner is the human Tlon user who should be invited and made admin.

## Gallery channels

Galleries use `heap/~host/name` and collect images, links, and other media.
When replying in a gallery conversation, reply normally: Hermes posts a
comment on the triggering gallery item. To create a distinct new top-level
item, use `tlon posts send heap/~host/name "text or URL"` (optionally
`--title "..."`); upload an image first, then use `--image <uploaded-url>`.

Reaction dispatches for a gallery comment include both its message id and its
thread root. React to that comment with `tlon posts react heap/~host/name
<comment-id> <emoji> --parent <post-id>`. Delete a gallery post with `tlon
posts delete heap/~host/name <post-id>`.
