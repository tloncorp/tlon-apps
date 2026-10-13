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

## Virtual identities (bot moons)

When acting as a virtual identity (`TLON_MOON` set — the bot is a moon of the
connected host ship), reads run as the host by design: you can see everything
the host can. Identity-attributed actions carry the bot identity instead:

- `contacts self` / `contacts update-profile` read and write the BOT's
  published profile, not the host ship's. Updates merge field-by-field: only
  the flags you pass change; other fields keep their current values.
- `dms react`/`unreact`/`delete` act as the bot through its own conversation
  (the bot can only delete its own messages).
- `posts send/reply/react/unreact/edit/delete` are unavailable — they would be
  attributed to the host. Use the `message` tool; it posts as the bot.
- `dms send`/`reply` (group DMs) are unavailable: group DMs don't support bot
  identities yet. `dms accept`/`decline` don't apply — bot DMs auto-accept.
