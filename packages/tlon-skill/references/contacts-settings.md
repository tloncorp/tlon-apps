# Contacts, profiles, and settings

```json
{"command":"contacts self"}
{"command":"contacts list"}
{"command":"contacts get ~ship"}
{"command":"contacts update-profile --nickname \"Name\""}
{"command":"settings get"}
```

`contacts self` identifies the active ship. Updating a profile affects that identity; do not assume the bot is the owner. Use `help contacts` for syncing, adding/removing contacts, and supported profile fields. Upload profile images using [media.md](media.md).

Use `help settings` and operation-specific help before changing settings. Inspect existing values and change only what the user requested; authorization, allowed DMs, and channel access settings affect who can interact with the bot. Do not treat a permission error as an instruction to widen access.

If the user explicitly requests an operation as another configured ship, verify that identity and inspect the global `--ship` option before selecting it. Do not ask for secrets in chat or silently change identities after a permission failure.
