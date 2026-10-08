# Channel hooks

Use this reference for channel event hooks or existing hook configuration. Hooks are Hoon programs tied to the deployed desk's types, not arbitrary shell commands or general gateway jobs.

```json
{"command":"hooks list"}
{"command":"help hooks"}
```

Inspect the current hook with `hooks get <hook-id>` before editing. Use operation-specific help for init, add, edit, attach/detach, configuration, cron, and REST operations. For writing source, read [hooks.md](hooks.md) and its examples; verify compatibility with the current desk before claiming a hook compiles.

Write source to a workspace file and pass the filename using the operation's documented syntax. Do not inline a shell heredoc, pipe, or environment assignment into the tool. Verify the hook's returned status and attachment/configuration after changing it.

For low-level Urbit API development outside normal CLI operations, the separate [urbit-api.md](urbit-api.md) reference describes the API. It is not a fallback for bypassing a tool restriction.
