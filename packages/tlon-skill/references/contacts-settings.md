# Contacts, profiles, and settings

```json
{"command":"contacts self"}
{"command":"contacts list"}
{"command":"contacts get ~ship"}
{"command":"contacts update-profile --nickname \"Name\""}
{"command":"settings get"}
```

`contacts self` identifies the acting ship, the harness's default identity (see the tool description). Updating a profile affects that identity; do not assume the bot is the owner. Use `help contacts` for syncing, adding/removing contacts, and supported profile fields. Upload profile images using [media.md](media.md).

Use `help settings` and operation-specific help before changing settings. Inspect existing values and change only what the user requested; authorization, allowed DMs, and channel access settings affect who can interact with the bot. Do not treat a permission error as an instruction to widen access.

`settings` always acts on the bot. Keys that control access (owner, DM allowlist, authorized ships, channel list and rules, pending approvals) cannot be set or deleted directly; use the dedicated commands where they exist. Do not ask for secrets in chat or switch identities after a permission failure.
