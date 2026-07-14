# claude-tlon-channel

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) that attaches
a **local Claude Code session** to Tlon conversations, logged in as a bot
ship. Inbound messages from attached channels/threads/DMs are pushed into the
running session as [MCP channel](https://code.claude.com/docs/en/channels)
events; the session replies as the bot via the bundled `tlon_send` tool.

Designed to coexist with an [OpenClaw](https://github.com/openclaw/openclaw)
gateway running as the **same ship** (see `packages/openclaw`): when this
plugin attaches to a scope it writes an `externalClaims` entry to the ship's
settings-store, and the OpenClaw Tlon plugin skips messages in claimed scopes
until the claim expires or is released.

```
Tlon user ──▶ bot ship (hosting infra)
                 │  SSE firehose (%chat /v4, %channels /v4)
                 ▼
        this MCP server (local) ──▶ notifications/claude/channel ──▶ your session
                 ▲                                                        │
                 └───────────── tlon CLI send/reply ◀─────────  tlon_send tool
```

## Requirements

- Claude Code **v2.1.80+** (MCP channels)
- Node 22+
- The `tlon` CLI from [`@tloncorp/tlon-skill`](../tlon-skill) on `PATH`
  (or point `TLON_CLI` at the binary) — used for outbound sends and reads
- Bot ship credentials (URL + `+code`)

## Setup

```bash
pnpm --filter @tloncorp/claude-tlon-channel build

# register the MCP server once (per project you'll run claude from)
claude mcp add tlon -- node /absolute/path/to/packages/claude-tlon-channel/dist/server.js

export TLON_URL="https://your-bot.tlon.network"
export TLON_SHIP="~your-bot"
export TLON_CODE="sampel-ticlyt-migfun-falmel"
# optional: scopes to attach on startup
export TLON_ATTACH="chat/~host/dev-chat,~sampel-palnet"

claude --dangerously-load-development-channels server:tlon
```

Channels are in research preview and custom channels aren't on the approved
allowlist, so the entry must be passed to
`--dangerously-load-development-channels` directly — the bypass is
per-entry, and `--channels server:tlon` alone is rejected. (Even once
packaged as a marketplace plugin, a non-official channel still needs the dev
flag: `claude --dangerously-load-development-channels plugin:tlon-channel@<marketplace>`.)
A dim `Channels (experimental)` notice below the startup banner confirms the
channel registered; server stderr lands in `~/.claude/debug/<session-id>.txt`.

Ask Claude to "attach to chat/~host/slug" (the `tlon-attach` skill guides
the workflow), or preset scopes with `TLON_ATTACH`.

## Scopes

| Scope                        | Meaning                          |
| ---------------------------- | -------------------------------- |
| `~ship`                      | one-to-one DM                    |
| `0v...`                      | group DM (club)                  |
| `chat/~host/slug`            | whole group channel              |
| `chat/~host/slug/<post-id>`  | a single thread (top-level post) |

## Coexisting with a hosted OpenClaw bot

Both processes log in as the same ship, so without coordination both would
answer inbound messages. Coordination is a settings-store entry on the ship
(desk `moltbot`, bucket `tlon`, key `externalClaims`) holding
`[{ scope, holder, expiresAt }]`:

- **Attach** writes a claim; the OpenClaw monitor drops messages whose scope
  is claimed and unexpired.
- Claims have a TTL (default 5 min, `TLON_CLAIM_TTL_MS`) and are refreshed
  at half TTL while the session is attached — if the local session crashes,
  the hosted bot resumes within one TTL.
- **Detach** / clean shutdown releases the claim immediately.
- Set `TLON_WRITE_CLAIMS=false` to observe without muting the hosted bot
  (both will respond).

The OpenClaw monitor never reacts to messages authored by the bot ship
itself, so this session's outbound posts don't re-trigger the hosted bot.

## Environment variables

| Variable             | Required | Default       | Purpose                              |
| -------------------- | -------- | ------------- | ------------------------------------ |
| `TLON_URL`           | yes      | —             | Ship HTTP endpoint                    |
| `TLON_SHIP`          | yes      | —             | Bot ship (`~ship`)                    |
| `TLON_CODE`          | yes      | —             | `+code` access code                   |
| `TLON_CLI`           | no       | `tlon`        | Path to the tlon-skill CLI binary     |
| `TLON_ATTACH`        | no       | —             | Comma-separated startup scopes        |
| `TLON_CLAIM_HOLDER`  | no       | `claude-code` | Holder id written into claims         |
| `TLON_CLAIM_TTL_MS`  | no       | `300000`      | Claim lifetime                        |
| `TLON_WRITE_CLAIMS`  | no       | `true`        | Set `false` to skip claiming          |

(`URBIT_URL` / `URBIT_SHIP` / `URBIT_CODE` are honored as aliases and take
precedence, matching tlon-skill conventions.)

## Status / known gaps

Scaffold-stage. Not yet covered:

- **Vouched identity**: sends go out as the ship the server logs in as. To
  appear as a distinct vouched bot identity (moon), the send path needs the
  vouched-DM route instead of plain `posts send`.
- `tlon posts reply` / `dms reply` argument order should be verified against
  the installed tlon-skill version (`tlon posts --help`).
- DM invites (new conversations) are ignored; attach to an existing DM.
- Edits, deletes, and reactions are not surfaced as events.
