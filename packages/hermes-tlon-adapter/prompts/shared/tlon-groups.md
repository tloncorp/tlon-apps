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
