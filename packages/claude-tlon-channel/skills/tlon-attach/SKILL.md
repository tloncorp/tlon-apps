---
name: tlon-attach
description: Attach this Claude Code session to a Tlon channel, thread, or DM so messages there flow into the session and replies go back out as the bot. Use when the user asks to join, watch, attach to, or talk in a Tlon conversation.
---

# Attach to a Tlon conversation

This session can participate in Tlon conversations through the `tlon` MCP
server (from the tlon-channel plugin). The session is logged in **as the bot
ship** — messages you send appear as the bot.

## Prerequisites

- The session was started with the channel enabled:
  `claude --dangerously-load-development-channels server:tlon` (custom
  channels aren't on the research-preview allowlist, so the entry goes on
  the dev flag — plain `--channels server:tlon` is rejected).
- Credentials are set: `TLON_URL`, `TLON_SHIP`, `TLON_CODE` (the bot ship
  and its +code).
- If the `tlon` MCP server or its tools are missing, tell the user to
  restart with the flag above and check those env vars.

## Workflow

1. Resolve what the user wants to attach to. Scope formats:
   - `~ship` — one-to-one DM with that ship
   - `0v...` — group DM (club id)
   - `chat/~host/slug` — a whole group channel
   - `chat/~host/slug/<post-id>` — one thread (top-level post id)

   If the user names a channel loosely ("the dev channel"), use `tlon_read`
   or ask; don't guess a nest.

2. Call `tlon_attach` with the scope. This also writes a settings-store
   claim so a hosted OpenClaw bot running as the same ship stops answering
   there while this session is attached.

3. Pull context with `tlon_read` (recent history, or `postId` for a
   thread) so you know the conversation before your first reply.

4. New messages arrive as channel events with `meta.target`,
   `meta.parentId`, and `meta.author`. Reply with `tlon_send` to the same
   target — and pass `parentId` when the message came from a thread.

5. When the user is done, call `tlon_detach` so the hosted bot resumes
   responding there. Detach on request or when the user says they're done
   with the conversation.

## Etiquette

- You are speaking as the bot in front of other people. Be conversational;
  no tool dumps, stack traces, or file contents unless asked.
- Don't reply to every message in a busy channel — respond when addressed
  or when the user asked you to handle something specific.
- If asked to do local work (code, builds), do it, then post a short
  summary back to the thread — not the raw output.
