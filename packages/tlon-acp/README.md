# `@tloncorp/tlon-acp`

Tlon-specific orchestration for any agent that implements the [Agent Client Protocol](https://agentclientprotocol.com/). The generic Gall/stdio bridge lives in `@tloncorp/acp`; this package adds Tlon Messenger routing, authorization, conversation sessions, and replies.

## Demo

Install `%acp` on the bot ship, build both packages, then run one of the pinned ACP adapters:

```sh
export TLON_URL=http://localhost:8080
export TLON_SHIP=bot
export TLON_CODE=...
export TLON_ACP_OWNER=zod
export TLON_ACP_CHANNELS=chat/~zod/general

tlon-acp-bot -- codex-acp
# or
tlon-acp-bot -- claude-agent-acp
```

To expose the existing `@tloncorp/tlon-skill` CLI to the agent, install its `tlon` binary in the bot image and set `TLON_ACP_TOOLS=cli`. The adapter inherits this worker's `TLON_URL`, `TLON_SHIP`, and `TLON_CODE`, so the CLI is ready for that bot ship. Protocol-native MCP servers can instead be supplied as an ACP `mcpServers` array in `ACP_MCP_SERVERS_JSON`.

DMs are accepted only from the owner and `TLON_ACP_DM_ALLOWLIST`. Channel messages are accepted only in `TLON_ACP_CHANNELS`, only from the owner or `TLON_ACP_CHANNEL_ALLOWLIST`, and require a bot mention by default. The owner may speak without a mention in channels hosted by the owner or bot. Set `TLON_ACP_REQUIRE_MENTION=false` or `TLON_ACP_OWNER_LISTEN=false` to change those two gates.

Each DM or channel gets its own ACP session. Turns in one conversation are serialized and the session IDs are persisted in `ACP_STATE_FILE` (default `.tlon-acp/sessions.json`). Tool permission requests are denied by default; `ACP_PERMISSION_POLICY=allow-once` is intentionally explicit.

## Hosted credentials

`ACP_ADAPTER_HOME` sets `HOME` only for the adapter child process. In a hosted worker, mount one encrypted, per-bot credential volume at that absolute path and never reuse it for another customer. Existing API-key environment variables may be used for a first deployment.

A later browser auth broker should:

1. authenticate the user outside this worker;
2. materialize the adapter's credential files into that bot's encrypted credential volume;
3. atomically rotate the mount and restart only that bot worker.

Credentials never travel through `%acp` queues, Tlon messages, or the session state file. Interactive adapter authentication still uses standard ACP `authMethods`/`authenticate`; turning adapter-specific browser launches into a hosted redirect or device-code flow belongs in the hosting control plane, not in this protocol-neutral package.
