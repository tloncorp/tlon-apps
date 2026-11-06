---
description: Connect tlon-memory to your Tlon ship and start capturing this directory
---

# Onboard tlon-memory

Connect the user's Tlon ship so conversations in this directory are archived in their Tlon Notes, where agents can save and search memories. Do these steps in order.

**The CLI** is not on PATH. In Claude Code it is `node "${CLAUDE_PLUGIN_ROOT}/bin/tlon-memory.js"`. In Codex it is `node <cli>`, with the `cli` path from the `Tlon memory:` line at session start; without that line, call the `tlon_status` tool, whose answer names it (`Run: node <cli> setup`). `<tm>` below stands for it.

1. **Check.** Run `<tm> status`.
   - `connected as ~ship`: say so, give the notebook URL from its `notebook:` field, and stop. If it says `capture OFF for <dir> (not in scope)`, offer `<tm> scope add <dir>` for the current directory and run it only if the user agrees.
   - `KEY REJECTED`: do steps 3 and 4 with `--reconnect` in place of `--scope <dir>`.
   - `not connected`: go on.
2. **Explain** in two sentences: conversations started in this directory (your messages and mine, tool calls and results truncated to 2 KB each) are saved as notes in a notebook on their ship, with nothing summarized; and anything an agent later retrieves from that notebook is sent to this client's model provider.
3. **Connect.** Run `<tm> setup --connect --scope "<current directory>" --yes` in the background: in Claude Code, Bash with `run_in_background`; in Codex, a long-running terminal session outside the sandbox (setup listens on 127.0.0.1, reaches the ship and writes `~/.tlon/memory`). Read its output until the line `Open http://127.0.0.1:<port>/<token> to connect your ship`, and give the user that link. Tell them the page asks for their ship URL and either their +code or their Notes API key, that it runs on their computer, and that you never see what they type. The link works once and expires in 10 minutes; if it expires, run this step again.
   - No Tlon account yet: send them to https://tlon.network/signup?source=agent first, then back to the link.
4. **Finish.** Wait for setup to exit.
   - Exit 0: run `<tm> status` and report the ship, the notebook URL and the capture scope.
   - Otherwise: report its last error line (the page shows the same) and offer a new link.
   - Codex: remind the user to run `/hooks` once and trust the three tlon-memory hooks. Nothing is captured until they do.

## Rules
- Never ask for the +code or the API key in chat, and never read `~/.tlon/memory/config.json`. If the user pastes either, do not repeat or use it; send them to the link.
- Capture only the current directory. Never pass another directory, `--scope none` or `--force-scope` without asking the user first.
