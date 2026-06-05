# Hermes Tlon Adapter

Minimal Hermes platform plugin for Tlon Messenger.

This first pass keeps the integration deliberately small:

-   inbound reads use Eyre SSE subscriptions for `channels /v2` and `chat /v3`
-   outbound sends use the packaged `tlon` CLI
-   a single model-callable `tlon` tool wraps the packaged CLI for reads/admin
-   a plugin-owned `image_search` tool finds direct image URLs for Tlon uploads
-   group channels dispatch on bot ship/name/alias wakes, explicit free-response config, or threads the bot has already replied to
-   DMs dispatch directly, subject to Hermes/Tlon allowlists

The model-visible `tlon` tool is not a delivery path. It blocks `posts send`, `posts reply`, `dms send`, `dms reply`, and `notebook` so normal replies stay inside Hermes' platform delivery path (`TlonAdapter.send()`).

When this package can find `@tloncorp/tlon-skill/SKILL.md`, it registers that file as the explicit plugin skill `tlon-platform:tlon`. The model-facing tool and platform hint point at `skill_view("tlon-platform:tlon")`, which works the same way in dev and production because the skill registration travels with the plugin. Set `TLON_SKILL_PATH` when the skill file lives somewhere non-standard.

If you explicitly want the skill to appear in Hermes' normal skill index as bare `tlon`, add the directory containing the skill to `skills.external_dirs` in the Hermes profile config. That is optional install-time configuration, not required for the plugin-owned default path.

## Docker Dev Loop

The fastest local loop is containerized and only requires this `tlon-apps` checkout. The image installs Hermes Agent from GitHub, mounts this monorepo, symlinks the adapter into a disposable Hermes profile, renders the managed Tlon prompt profile, builds a Linux `tlon` CLI from `packages/tlon-skill`, and runs `hermes gateway run`.

```bash
cd packages/hermes-tlon-adapter
cp .env.example .env
# Fill in TLON_* and Hermes model credentials.
pnpm dev
```

Useful commands:

```bash
pnpm dev:shell
pnpm dev:down
```

Set `HERMES_PLUGINS_DEBUG=1` or `HERMES_GATEWAY_ARGS="--replace -vv"` in `.env` when you want the very chatty Hermes startup logs.

Hermes' `web_search` is the closest match for OpenClaw search, and `web_extract` is the closest match for OpenClaw `web_fetch`. To enable Brave-backed `web_search` in the dev container, set `BRAVE_SEARCH_API_KEY` in `.env`. The same key enables the plugin-owned `image_search` tool, which mirrors the tiny TlonBot image-search helper and returns image URLs suitable for `tlon upload`. The dev entrypoint also accepts the older OpenClaw-style `BRAVE_API_KEY` alias and exports it as `BRAVE_SEARCH_API_KEY` for Hermes. When a Brave key is present, the disposable Hermes profile is pinned to `web.search_backend: brave-free`.

Brave is search-only, so set an extraction backend when you want `web_extract`/page reads too. The dev entrypoint auto-pins `web.extract_backend` when it sees `FIRECRAWL_API_KEY`, `FIRECRAWL_API_URL`, `FIRECRAWL_GATEWAY_URL`, `TOOL_GATEWAY_DOMAIN`, `PARALLEL_API_KEY`, `TAVILY_API_KEY`, or `EXA_API_KEY`. You can override this with `HERMES_WEB_SEARCH_BACKEND`, `HERMES_WEB_EXTRACT_BACKEND`, or shared `HERMES_WEB_BACKEND`.

By default the image builds Hermes from `NousResearch/hermes-agent` at `main`. Override these in `.env` when testing against a fork or pinned branch/tag:

```bash
HERMES_AGENT_REPO=https://github.com/NousResearch/hermes-agent.git
HERMES_AGENT_REF=main
```

## Managed Prompt Profile

The dev container renders templates from `prompts/` into the disposable Hermes profile on every `pnpm dev` run:

-   `prompts/hermes/SOUL.md` -> `$HERMES_HOME/SOUL.md`
-   `prompts/hermes/.hermes.md` -> `$HERMES_HOME/.hermes.md`
-   `prompts/hermes/USER.md` -> `$HERMES_HOME/memories/USER.md`

`TERMINAL_CWD` defaults to `$HERMES_HOME` so Hermes discovers the generated `.hermes.md`. Managed blocks are replaced in place on subsequent runs while preserving any unmanaged profile text.

## Local Install Shape

Hermes discovers platform plugins under `~/.hermes/plugins/platforms/<name>/`. For local testing, copy or symlink this directory there as `tlon`, install the Python dependency, and make sure the `tlon` CLI is on `PATH`.

```bash
pip install -r requirements.txt
npm install -g @tloncorp/tlon-skill
```

## Configuration

Required:

```bash
TLON_NODE_URL=https://your-node.tlon.network
TLON_NODE_ID=~your-node
TLON_ACCESS_CODE=your-access-code
```

Optional:

```bash
TLON_CHANNELS=chat/~host/channel
TLON_OWNER_SHIP=~friend
TLON_HOME_CHANNEL=~friend # optional override; defaults to TLON_OWNER_SHIP DM
TLON_ALLOWED_USERS=~other-friend # optional additional users; owner is automatic
TLON_ALLOW_ALL_USERS=false
TLON_DM_ALLOWLIST=
TLON_AUTO_DISCOVER=false
TLON_BOT_MENTIONS=hermes
TLON_FREE_RESPONSE_CHANNELS=chat/~host/channel
TLON_REQUIRE_MENTION=true
TLON_KNOWN_BOT_USERS=~other-bot
TLON_MAX_CONSECUTIVE_BOT_RESPONSES=2
TLON_CLI=tlon
TLON_SSE_READ_TIMEOUT_SECONDS=60
TLON_SKILL_PATH=/path/to/tlon-skill/SKILL.md # optional explicit plugin-skill path
TLON_GATEWAY_STATUS=true
TLON_GATEWAY_STATUS_OWNER=~friend # optional override; defaults to TLON_OWNER_SHIP
```

The adapter also accepts the older `TLON_SHIP_*`, `TLON_URL/TLON_SHIP/TLON_CODE`, and `URBIT_*` aliases and passes them through to the CLI, so it works with the credential resolver in `@tloncorp/tlon-skill`.

Group attention is deterministic and happens before the model runs. Messages from allowed users dispatch when they mention the node id, bare node id, an alias in `TLON_BOT_MENTIONS`, or the node profile nickname fetched at startup. Nickname lookup failures are non-fatal; the adapter falls back to node id, bare node id, and configured aliases.

`TLON_FREE_RESPONSE_CHANNELS` and `TLON_REQUIRE_MENTION=false` allow unmentioned group messages to dispatch, but only when `TLON_OWNER_SHIP`, `TLON_ALLOWED_USERS`, or `TLON_ALLOW_ALL_USERS` is set. `TLON_DM_ALLOWLIST` is additive for DMs and does not grant group-channel access.

`TLON_KNOWN_BOT_USERS` enables channel-scoped loop protection for group messages. Explicit mentions from known bots still count toward `TLON_MAX_CONSECUTIVE_BOT_RESPONSES`; human dispatches reset the counter.

Hermes' Tlon home channel defaults to the explicit owner DM from `TLON_OWNER_SHIP`. The owner is also added to the runtime `TLON_ALLOWED_USERS` value that Hermes core checks before pairing, so the owner can DM the bot without a pairing prompt. Set `TLON_HOME_CHANNEL` only when cron, cross-platform deliveries, or startup notices should go somewhere else. `TLON_ALLOWED_USERS` and `TLON_DM_ALLOWLIST` are never used to infer ownership.

Tlon profile changes such as nickname, avatar, bio, status, and cover are owner-only in Tlon chat sessions. For avatar/cover changes, the model should upload a direct raster image URL or local file with `tlon upload` and then pass the returned uploaded URL to `tlon contacts update-profile`; source image URLs and SVGs should not be used as profile images.

When `BRAVE_SEARCH_API_KEY` or `BRAVE_API_KEY` is configured, the adapter registers `image_search` under the Tlon toolset. Use this for user-requested images rather than asking the model to infer direct image URLs from ordinary web search results.

When `TLON_GATEWAY_STATUS` is enabled, the adapter pokes `%gateway-status` on connect, heartbeat, and disconnect. `TLON_GATEWAY_STATUS_OWNER` defaults to `TLON_OWNER_SHIP` when omitted.

The adapter reconnects its Eyre SSE channel when no bytes arrive for `TLON_SSE_READ_TIMEOUT_SECONDS`. This is meant to recover stale sleep/wake sockets and mirrors the byte timeout behavior in `@tloncorp/api`.
