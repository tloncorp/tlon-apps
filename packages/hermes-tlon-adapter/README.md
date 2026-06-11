# Hermes Tlon Adapter

Minimal Hermes platform plugin for Tlon Messenger.

This first pass keeps the integration deliberately small:

-   inbound reads use Eyre SSE subscriptions for `channels /v2` and `chat /v3`
-   outbound sends use the packaged `tlon` CLI
-   a single model-callable `tlon` tool wraps the packaged CLI for reads/admin
-   a plugin-owned `image_search` tool finds direct image URLs for Tlon uploads
-   group channels dispatch on bot ship/name/alias wakes, owner-listen, explicit free-response config, or threads the bot has already replied to
-   group dispatches carry recent channel/thread history as context
-   DMs dispatch directly, deny-by-default: unknown senders queue for owner approval with rich A2UI approve/deny cards

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
TLON_OWNER_LISTEN=true
TLON_OWNER_LISTEN_DISABLED_CHANNELS=
TLON_OWNER_LISTEN_ENABLED_CHANNELS=
TLON_CONTEXT_MESSAGES=20
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

## Access Control & Approvals

Authorization is **deny-by-default**: a ship may interact only if it is the owner, on `TLON_ALLOWED_USERS`/`TLON_DM_ALLOWLIST`, granted through the settings store (see below), or `TLON_ALLOW_ALL_USERS=true` is set as an explicit dev override.

The adapter is the single gate. It declares `enforces_own_access_policy` to Hermes core, and the platform registration deliberately does not export auth env names to core — otherwise core's own env-allowlist/pairing gate would re-check senders and block settings-store grants it cannot see (approved DMs, open channels). Hermes' generic pairing-code flow therefore does not apply to Tlon; the Tlon-native approval flow below replaces it. One caveat: a globally configured `GATEWAY_ALLOWED_USERS` re-engages core's gate for all platforms, Tlon included.

When `TLON_OWNER_SHIP` is configured, unknown ships are not silently dropped — they queue for owner approval:

-   a **DM invite** from an unknown ship queues with a `(DM invite - no message yet)` preview (pending invites are also picked up by scry at connect, so invites that arrived while the gateway was down are not lost)
-   a **DM message** from an unapproved ship in an accepted conversation queues with the message preview and is replayed after approval
-   an **unauthorized mention** in a restricted group channel queues a channel request; approval grants that ship access in that channel and replays the mention (with channel context)
-   a **group invite** from an unapproved inviter queues a group request; approval joins the group (`tlon groups accept-invite`) and pulls the group's channels into the monitored set so the bot is addressable there. Invites are detected live via a `groups /v1/foreigns` subscription and caught up by scrying `/groups-ui/v7/init` at connect. The owner ship and `TLON_GROUP_INVITE_ALLOWLIST` (settings key `groupInviteAllowlist`) auto-accept; rejection leaves the invite untouched in Tlon.

The owner is notified by DM with a plain-text summary plus an **A2UI approval card** (post-blob entry, rendered by current Tlon clients in DMs): Allow / Reject / Block buttons that type the matching command back into the DM via the `tlon.sendMessage` action, and a View-message button (`tlon.navigate`) when there is a source message. Old clients fall back to the text.

Owner commands (deterministic, never wake the model):

```
/pending                  list pending requests
/allow <id>               approve (accepts the DM/group invite if needed, grants access, replays the message)
/reject <id>              drop the request; a pending DM/group invite is left untouched
/ban <id|~ship>           block natively via %chat (and clear pending requests from that ship)
/unban ~ship              unblock
/banned                   list blocked ships
```

Approved DM senders persist in the `dmAllowlist` %settings key and pending requests in `pendingApprovals` (48h TTL) — the same keys the OpenClaw plugin uses, so state carries over in both directions. Bans use Tlon's native ship blocking (no plugin state). Repeat messages from a still-pending ship update the stored preview but re-notify the owner at most every 10 minutes.

### Per-Channel Open Access

`/channel-access` controls who can address the bot in a group channel:

```
/channel-access                       status for the current channel
/channel-access open [<nest>]         anyone in the channel can mention the bot
/channel-access restricted [<nest>]   only authorized/approved ships (default)
/channel-access list                  all per-channel rules
```

Open mode still requires a mention (use `TLON_FREE_RESPONSE_CHANNELS` for unmentioned dispatch). Rules persist in the OpenClaw-compatible `channelRules` settings key, including per-channel `allowedShips` written by channel approvals. Opening an unmonitored channel also starts monitoring it.

`TLON_KNOWN_BOT_USERS` enables channel-scoped loop protection for group messages. Explicit mentions from known bots still count toward `TLON_MAX_CONSECUTIVE_BOT_RESPONSES`; human dispatches reset the counter.

## Owner-Listen

Owner-listen hears the owner without a mention in group channels, ported from the OpenClaw plugin. Channels hosted by the bot or owner ship are on by default; the owner can opt **any** channel in or out at runtime with a chat command the adapter handles deterministically (the model is never woken):

```
/owner-listen                       # status for the current channel
/owner-listen on|off [<nest>]       # toggle a channel (defaults to the current one)
/owner-listen on|off ~host/group    # toggle every channel of a group at once
/owner-listen list                  # global state, default mode, per-channel overrides
/owner-listen all on|off            # global kill switch
/owner-listen default owned|all     # default: owned channels only, or every monitored channel
```

The command works from any monitored group channel (mentioned or not — it is an escape hatch that runs before the attention gate) and from the owner DM with an explicit nest or group flag. Enabling channels that are not currently monitored also adds them to the monitored set and persists them. Group targets expand to the group's channels at command time (the bot must be a member); approving a group invite reminds the owner of the group form when the group is not owner/bot-hosted. `default all` flips the no-override default from owned-channels to every monitored channel — including future group joins — with explicit per-channel `on`/`off` overrides staying sticky across default flips.

State lives in the ship's `%settings` store under desk `moltbot`, bucket `tlon`, using the same entry keys as OpenClaw (`ownerListenEnabled`, `ownerListenDisabledChannels`, plus the additive `ownerListenEnabledChannels`, `ownerListenDefault`, and the shared `groupChannels`), so an existing OpenClaw deployment's toggles carry over and survive gateway reboots. The adapter loads the store on connect, subscribes to `%settings` updates for live hot-reload (writes from Landscape or another gateway apply without a restart, matching OpenClaw's del/invalid-entry semantics), and re-syncs after every SSE reconnect since settings events do not replay. `TLON_OWNER_LISTEN*` env vars only seed defaults for keys the store does not have.

## Versioning

`/tlon-version` (owner-only, intercepted deterministically like `/owner-listen`) reports what is running, one `Field: value` per line (chat reply italicizes keys and bolds values for scannability; the startup log is plain):

```
*Harness*: **Hermes**
*Adapter Version*: **0.1.0**
*Tlon Skill*: **0.3.2**
*Fingerprint*: **fp1:3f9a2c1b8d02**
*Source*: **lb/hermes-init @ d8ae0c4e (clean)**
```

-   **Harness** — always `Hermes`; identifies which bot framework is running this node at a glance.
-   **Adapter Version** — semver from this package's `package.json`, bumped at releases.
-   **Tlon Skill** — version of the packaged `@tloncorp/tlon-skill` CLI (first line of `tlon --version`).
-   **Fingerprint** — sha256 over the runtime files (non-test `*.py`, `plugin.yaml`, `prompts/`), so copied or hand-patched installs are still identifiable. To match a fingerprint to a commit, recompute it at a candidate checkout: `python3 -c "import version; print(version.content_fingerprint())"` from this directory.
-   **Source** — git branch, short commit, and dirty state, resolved at command time when the install is a git checkout (the dev loop's symlinked monorepo always is). Reads `no git checkout` otherwise.

Nothing is generated or checked in; identity is resolved at runtime. The same summary is logged at gateway startup.

## Telemetry

Opt-in PostHog telemetry (official `posthog` SDK): set `TLON_TELEMETRY=true` and `TLON_TELEMETRY_API_KEY` (optional `TLON_TELEMETRY_HOST`). Disabled by default and zero-cost when off.

Every event carries `harness: "hermes"` (segment from OpenClaw-emitted events), `botShip`, `ownerShip`, and the adapter version identity (`adapterVersion`, `adapterFingerprint`) so charts map to the exact running code. As in OpenClaw, the **owner ship is the PostHog distinct id** (identified once with `tlonOwnerShip`/`tlonBotShip` person properties), so bot events join the owner's identity — and telemetry requires `TLON_OWNER_SHIP`; without it, events are skipped with a one-time log warning.

| event                        | when                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TlonBot Reply Handled`      | per handled turn — OpenClaw-compatible properties (outcome, chatType, senderRole, counts, durations, model/provider, `toolUsage`) plus `dispatchReason`, a `cliUsage` rollup of CLI calls made in the turn, and `processingOutcome` from Hermes (so `outcome` distinguishes `responded`/`no_reply`/`error`/`cancelled`; turns that never complete surface as `abandoned`) |
| `TlonBot CLI Call`           | per deliberate `tlon` CLI invocation — segmented as `commandRoot`/`commandAction`/`commandFlags` (flag names only, never values) plus the combined `command` label, with origin (`model_tool`/`invite_rsvp`/`version`/`adapter`), duration, returncode, error kind. Message-send plumbing (`delivery`/`control_plane`/`owner_notification`) is suppressed when successful — replies are already counted in Reply Handled — but still emits on failure |
| `TlonBot Error`              | failures at component level: `settings`, `approval`, `moderation`, `context_fetch`, `gateway_status` (incl. heartbeats), `presence`, `event_handler` (adapter bugs, kept distinct from stream errors), `connect` |
| `TlonBot Gateway Connected`  | per connect, with version identity, CLI version, and settings-state counts                                                                                                                                    |
| `TlonBot Gateway Disconnected` / `TlonBot SSE Reconnect` | shutdowns (uptime) and stream reconnects (attempt, backoff, error type)                                                                                                           |
| `TlonBot Approval Event`     | `queued`/`renotified`/`allowed`/`rejected`/`banned`/`unbanned` with request type                                                                                                                              |
| `TlonBot Control Command`    | which owner command ran (name only)                                                                                                                                                                           |
| `TlonBot Telemetry Test`     | manual delivery check triggered by `/tlon-telemetry test`                                                                                                                                                     |

Strictly content-free: no message text, no CLI arguments, no channel nests; ship ids are scrubbed from error detail. Per-message drop events are deliberately not emitted (volume without insight) — unauthorized senders surface as approval `queued` events instead.

### Debugging telemetry

When a deployment shows nothing in PostHog, work through the built-in diagnostics:

1. **Startup log** — the gateway logs the resolved telemetry state at construction, including the *reason* when off: `[tlon] telemetry disabled: TLON_TELEMETRY is not enabled …` / `…API_KEY is not set` / `PostHog client init failed` (posthog package missing), or `[tlon] telemetry enabled (PostHog): key phc_…wxyz (47 chars), host default (https://us.i.posthog.com), events identify as owner ~sampel (bot ~palnet), debug off`.

    **Where these appear.** The gateway console (stderr) shows **WARNING and above by default** — INFO is hidden unless you run the gateway with `-v`. So the *failure* states are logged at WARNING and show up unprompted: telemetry requested but unable to run (no key, posthog not installed), and enabled-but-ownerless (every event skipped). The healthy/off-by-default states are INFO, hidden on a default console. Regardless of console level, **all of it is always written to `~/.hermes/logs/agent.log`** (INFO+, profile-aware) — that file is the reliable place to read the full startup state. When telemetry is genuinely broken you'll see the WARNING on the console; to confirm a *working* config without restarting, use `/tlon-telemetry` (below), which doesn't depend on log level at all.
2. **`/tlon-telemetry`** (owner-only, deterministic like `/tlon-version`) — replies with live status: each setting's value *and source* (`env TLON_TELEMETRY` vs `config telemetry` vs unset), masked API key, host, installed posthog SDK version, the distinct id events are sent as (the owner ship), whether the one-time identify was enqueued and as whom, events enqueued since gateway start, and any capture or delivery failures with ages.
3. **`/tlon-telemetry test`** — end-to-end verification: enqueues a `TlonBot Telemetry Test` event and synchronously flushes the SDK queue, then reports `Test event accepted by PostHog … as ~sampel` or the delivery error. This catches the failure modes that are otherwise invisible (malformed API key, wrong region host, blocked egress), because the posthog SDK's worker thread swallows upload errors. May take up to a minute when the network is down (SDK retries). Caveat: PostHog's ingestion endpoint accepts any well-formed batch and drops wrong-project keys later, so an accepted test that never appears in the dashboard means the key belongs to a different project.
4. **`TLON_TELEMETRY_DEBUG=true`** — logs every capture/identify enqueue at info level plus the posthog SDK's internal debug output, and elevates repeated delivery failures from debug to warning.

Delivery failures are also surfaced without debug mode: the adapter hooks the SDK's `on_error` callback and warns on the first failed batch (`[tlon] telemetry delivery to PostHog failed …`).

## Reply Placement

Group replies post **top-level** in the channel (Tlon chat channels are linear), and conversations that are already threads are continued in-thread, attached to the thread root. Set `TLON_REPLY_IN_THREAD=true` to instead start a thread on every triggering message. DM replies are always plain writs.

## Group Message Context

When the bot wakes in a group channel it prepends recent history to the dispatched message so it can answer in context: the last `TLON_CONTEXT_MESSAGES` channel messages (default 20) for top-level wakes, or the parent post plus thread replies for thread wakes. Context fetches use the same `/channels/v4` scries as OpenClaw and degrade gracefully — on failure the bare message is dispatched. Set `TLON_CONTEXT_MESSAGES=0` to disable.

Hermes' Tlon home channel defaults to the explicit owner DM from `TLON_OWNER_SHIP`. Set `TLON_HOME_CHANNEL` only when cron, cross-platform deliveries, or startup notices should go somewhere else. `TLON_ALLOWED_USERS` and `TLON_DM_ALLOWLIST` are never used to infer ownership.

Tlon profile changes such as nickname, avatar, bio, status, and cover are owner-only in Tlon chat sessions. For avatar/cover changes, the model should upload a direct raster image URL or local file with `tlon upload` and then pass the returned uploaded URL to `tlon contacts update-profile`; source image URLs and SVGs should not be used as profile images.

When `BRAVE_SEARCH_API_KEY` or `BRAVE_API_KEY` is configured, the adapter registers `image_search` under the Tlon toolset. Use this for user-requested images rather than asking the model to infer direct image URLs from ordinary web search results.

When `TLON_GATEWAY_STATUS` is enabled, the adapter pokes `%gateway-status` on connect, heartbeat, and disconnect. `TLON_GATEWAY_STATUS_OWNER` defaults to `TLON_OWNER_SHIP` when omitted.

The adapter reconnects its Eyre SSE channel when no bytes arrive for `TLON_SSE_READ_TIMEOUT_SECONDS`. This is meant to recover stale sleep/wake sockets and mirrors the byte timeout behavior in `@tloncorp/api`.
