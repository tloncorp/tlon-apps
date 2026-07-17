# Hermes Tlon Adapter

Minimal Hermes platform plugin for Tlon Messenger.

This first pass keeps the integration deliberately small:

-   inbound reads use Eyre SSE subscriptions for `channels /v2` and `chat /v3`
-   outbound sends use the packaged `tlon` CLI
-   a single model-callable `tlon` tool wraps the packaged CLI for reads/admin
-   a plugin-owned `image_search` tool finds direct image URLs for Tlon uploads
-   group channels dispatch on bot ship/name/alias wakes, owner-listen, owner posts carrying a post-blob attachment (any monitored channel), explicit free-response config, or threads the bot has already replied to
-   group dispatches carry recent channel/thread history as context
-   DMs dispatch directly, deny-by-default: unknown senders queue for owner approval with rich A2UI approve/deny cards

The model-visible `tlon` tool is not a delivery path. It blocks text `posts send`, `posts reply`, `dms send`, and `dms reply` when they target the current conversation, so normal replies stay inside Hermes' platform delivery path (`TlonAdapter.send()`); proactive sends to other channels/DMs and `--image` sends anywhere remain allowed. It separately blocks `notebook`, since the `%diary` backend is removed — use `tlon notes` for `%notes` notebooks.

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

By default the image builds Hermes from `NousResearch/hermes-agent` at the pinned spike tag `v2026.6.19` (observed as commit `2bd1977d8fad185c9b4be47884f7e87f1add0ce3`). Override these in `.env` when testing against a fork or another pinned branch/tag/commit:

```bash
HERMES_AGENT_REPO=https://github.com/NousResearch/hermes-agent.git
HERMES_AGENT_REF=v2026.6.19
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
TLON_OWNER_SHIP=~friend
```

Optional:

```bash
TLON_CHANNELS=chat/~host/channel
TLON_HOME_CHANNEL=~friend # optional override; defaults to TLON_OWNER_SHIP DM
TLON_ALLOWED_USERS=~other-friend # optional additional users; owner is automatic
TLON_ALLOW_ALL_USERS=false
TLON_DM_ALLOWLIST=
TLON_AUTO_DISCOVER=false # seed default only; the autoDiscoverChannels settings key overrides it — see Settings-Key Parity
TLON_BOT_MENTIONS=hermes
TLON_FREE_RESPONSE_CHANNELS=chat/~host/channel
TLON_REQUIRE_MENTION=true
TLON_OWNER_LISTEN=true
TLON_OWNER_LISTEN_DISABLED_CHANNELS=
TLON_OWNER_LISTEN_ENABLED_CHANNELS=
TLON_CONTEXT_MESSAGES=20
TLON_REACTION_LEVEL=minimal # off, ack, minimal, or extensive
TLON_KNOWN_BOT_USERS=~other-bot
TLON_MAX_CONSECUTIVE_BOT_RESPONSES=3
TLON_CLI=tlon
TLON_SSE_READ_TIMEOUT_SECONDS=60
TLON_SKILL_PATH=/path/to/tlon-skill/SKILL.md # optional explicit plugin-skill path
TLON_GATEWAY_STATUS=true
TLON_GATEWAY_STATUS_OWNER=~friend # optional override; defaults to TLON_OWNER_SHIP
TLON_CONTEXT_LENS=true # off by default; durable bot-run records via %steward
TLON_CONTEXT_LENS_OWNER=~friend # optional; defaults to TLON_OWNER_SHIP
```

`TLON_OWNER_SHIP` is required: it defines the owner identity for approvals, owner-only tools such as `tlon`/`cronjob`/MCP/file tools, owner-listen, telemetry identity, and home-channel defaults. Without it, Tlon chat-session tool calls fail closed.

## Context Lens

Context Lens records each bot run (context sources, model, tool calls, timings, outputs) on-ship via the `%steward` agent and surfaces them in Tlon Messenger (badge / Bot Run sheet). Hermes uses the same protocol as OpenClaw.

**Harness**

```bash
TLON_CONTEXT_LENS=true
# optional; defaults to TLON_OWNER_SHIP
# TLON_CONTEXT_LENS_OWNER=~friend
```

Restart the Hermes gateway after changing these.

**Tlon Messenger (owner install)**

-   Settings → Experimental Features → **Enable bot context lens panel**
-   Leave **Context lens gateway URL** and **Context lens gateway token** blank. Those are the old direct HTTP stream to a local harness gateway (web-only). They are not required for durable `%steward` records and will not fix a missing steward.

**Ships**

1. `%steward` must be **running** on both the bot ship and the owner ship (`+gall/agents %groups` → `status: running %steward`). It ships with a current `%groups` desk.
2. On the **owner** ship, explicitly trust the bot once. Moon sponsorship is **not** auto-trust:

```hoon
:steward &steward-action-1 [%trust-bot ~your-bot-ship]
```

3. Test with a **new** bot reply. Historical messages do not gain badges retroactively.

**Data path**

1. Hermes probes bot `%steward` with an Eyre scry of `/steward/v1/lens/recent` (care `%x` is applied by Gall/Eyre — do not put `/x/` in the HTTP path).
2. Healthy log: `[tlon] context-lens sync active (owner=~...)`.
3. Hermes pokes run milestones to bot `%steward`; the bot fans them to the trusted owner over Ames.
4. The owner client loads runs from **owner** `%steward` (local DB after sync/scry). Bot-side `{"recent":[]}` is normal when the owner is a different ship — the durable UI store is on the owner.
5. If the badge appears but the Bot Run sheet says the run is unavailable, owner `%steward` is usually missing trust for the bot (or not installed/running).

**Not the same as gateway status**

`TLON_GATEWAY_STATUS` still pokes the legacy `%gateway-status` agent for online/offline notices. Context Lens uses `%steward`. A ship slog of `steward: gateway lease expired…` means steward is alive and a lease timed out; it does not mean Context Lens is disabled.

The adapter also accepts the older `TLON_SHIP_*`, `TLON_URL/TLON_SHIP/TLON_CODE`, and `URBIT_*` aliases and passes them through to the CLI, so it works with the credential resolver in `@tloncorp/tlon-skill`.

Group attention is deterministic and happens before the model runs. Messages from allowed users dispatch when they mention the node id, bare node id, an alias in `TLON_BOT_MENTIONS`, or the node profile nickname. The nickname is fetched at startup and tracked live via a `contacts /v1/news` subscription: renaming the bot (including during onboarding) updates the wake terms without a restart, clearing the nickname drops that term, and the profile is re-synced after each SSE reconnect. Nickname lookup failures are non-fatal; the adapter falls back to node id, bare node id, and configured aliases.

Owner posts carrying a post-blob attachment (the essay `blob` field — e.g. a file/voice-memo attachment) dispatch in any monitored group channel regardless of owner-listen state, mirroring OpenClaw's `hasBlob && isOwner` engagement. This is the raw `blob` field only; inline Story image blocks are not a wake signal (matching OpenClaw), though they are still rendered for the model once a message dispatches.

`TLON_FREE_RESPONSE_CHANNELS` and `TLON_REQUIRE_MENTION=false` allow unmentioned group messages to dispatch for the owner, explicitly allowed users, or all users when `TLON_ALLOW_ALL_USERS=true`. `TLON_DM_ALLOWLIST` is additive for DMs and does not grant group-channel access.

`TLON_AUTO_DISCOVER` only seeds the _default_ the adapter uses when the `autoDiscoverChannels` settings key has no entry; once the store has a value, the store wins (see [Settings-Key Parity](#settings-key-parity-dashboard--openclaw)). When on, an inbound message in an unmonitored `chat/` or `heap/` channel starts monitoring it; group/diary channels and channels the bot merely joined without ever receiving a message stay unmonitored until explicitly added (narrower than OpenClaw's proactive full-membership discovery — deliberate, see below). Turning the toggle back off stops _new_ discovery but does not un-monitor channels already discovered; that only clears on gateway restart.

## Access Control & Approvals

Authorization is **deny-by-default**: a ship may interact only if it is the owner, on `TLON_ALLOWED_USERS`/`TLON_DM_ALLOWLIST`, granted through the settings store (see below — `dmAllowlist` for DMs; `channelRules`/`defaultAuthorizedShips` for channels), or `TLON_ALLOW_ALL_USERS=true` is set as an explicit dev override.

The adapter is the single gate. It declares `enforces_own_access_policy` to Hermes core, and the platform registration deliberately does not export auth env names to core — otherwise core's own env-allowlist/pairing gate would re-check senders and block settings-store grants it cannot see (approved DMs, open channels). Hermes' generic pairing-code flow therefore does not apply to Tlon; the Tlon-native approval flow below replaces it. One caveat: a globally configured `GATEWAY_ALLOWED_USERS` re-engages core's gate for all platforms, Tlon included.

Unknown ships are not silently dropped — they queue for owner approval:

-   a **DM invite** from an unknown ship queues with a `(DM invite - no message yet)` preview (pending invites are also picked up by scry at connect and after every SSE reconnect, so invites that arrived while the gateway was down are not lost). An already-allowlisted ship (env allowlists or the `dmAllowlist` settings key) auto-accepts natively without queuing when `autoAcceptDmInvites` is on; with it off (the default), the invite is left pending in Tlon rather than re-queued as a fresh approval. Only the owner's invite bypasses the toggle — see [Settings-Key Parity](#settings-key-parity-dashboard--openclaw) below
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

A restricted channel whose rule has no explicit `allowedShips` (including channels with no rule at all) falls back to the settings key `defaultAuthorizedShips` — a global list of ships pre-authorized in every restricted channel, mirroring OpenClaw. An explicit `allowedShips` list on the rule — even an empty one, which blocks everyone — always wins over the default. `defaultAuthorizedShips` grants channel access only; it does not authorize DMs (use `dmAllowlist`/`TLON_DM_ALLOWLIST` for that).

Group-channel bot-loop protection is on by default for messages whose channel author is bot metadata. `TLON_KNOWN_BOT_USERS` supplements that dynamic detection for bots that still post with plain ship-string authors. Consecutive bot dispatches are capped by `TLON_MAX_CONSECUTIVE_BOT_RESPONSES` (default 3; set `0` for unlimited), the final allowed reply includes a "mention me to continue" addendum, and human dispatches reset the counter.

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

## Settings-Key Parity (Dashboard / OpenClaw)

Tlon's hosting service (the backend behind the web dashboard and in-app bot settings for hosted bots) writes seven `%settings` keys under desk `moltbot`, bucket `tlon`. Hermes reads all seven, so a dashboard/in-app edit takes effect on a Hermes bot the same as it would on an OpenClaw bot:

| key                      | effect                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `dmAllowlist`            | approved DM senders (see [Access Control & Approvals](#access-control--approvals))                          |
| `channelRules`           | per-channel open/restricted mode + `allowedShips` (see [Per-Channel Open Access](#per-channel-open-access)) |
| `groupChannels`          | extra monitored channels, additive to `TLON_CHANNELS`                                                       |
| `groupInviteAllowlist`   | inviters whose group invites auto-accept                                                                    |
| `defaultAuthorizedShips` | global fallback `allowedShips` for restricted channels whose rule doesn't pin its own list                  |
| `autoAcceptDmInvites`    | whether an allowlisted ship's native DM invite auto-accepts (default off; owner always accepts)             |
| `autoDiscoverChannels`   | whether an inbound message in an unmonitored `chat/`/`heap/` channel starts monitoring it (default off)     |

All seven load on connect, hot-reload live via the `%settings` subscription (no restart needed), and re-sync after every SSE reconnect. `autoAcceptDmInvites`/`autoDiscoverChannels` are read as strict booleans — a non-boolean or missing value falls back to the default (`autoAcceptDmInvites` to `false`; `autoDiscoverChannels` to the `TLON_AUTO_DISCOVER` seed) rather than being truthy-coerced. `defaultAuthorizedShips` accepts only string ship entries; non-string list items are dropped, not coerced.

The `autoAcceptDmInvites` gate follows OpenClaw exactly: only the **owner's** invite bypasses the toggle; every other allowlisted ship — env `TLON_ALLOWED_USERS`/`TLON_ALLOW_ALL_USERS`/`TLON_DM_ALLOWLIST` or the settings-store `dmAllowlist` — is gated, and a gated-off invite is left pending in Tlon (not queued as a fresh approval; the ship is already approved). Unknown ships queue for owner approval regardless of the flag.

**Read the current key, not OpenClaw's legacy duplicate.** OpenClaw historically also has an `autoDiscover` key; the hosting dashboard writes `autoDiscoverChannels`, and that is the only one Hermes reads.

### Divergences from OpenClaw (intentional)

-   **Auto-discover default and scope.** Hermes defaults `autoDiscoverChannels`/`TLON_AUTO_DISCOVER` to **off** (OpenClaw's setup wizard defaults it on), staying conservative/deny-by-default. Scope is also narrower: a reactive per-message check that only adds `chat/`/`heap/` channels the bot is already a member of, versus OpenClaw's proactive discovery of every channel across every joined group on connect. Broadening to that proactive scope is a larger change and out of scope here.
-   **Known limitation:** a ship queued as unknown and _later_ added to `dmAllowlist` via the dashboard is not retroactively auto-accepted from its pending native invite — it stays marked processed (which survives SSE reconnects) until the owner runs `/allow`, or the gateway fully restarts. A restart's re-scan does correctly accept it at that point; a pure invite approval is cleared (no dangling `/pending` card), while one enriched with a queued message is kept so `/allow` can still replay that message.

### What the dashboard can and can't edit

The seven keys above are the full "dashboard edit works" set. Everything else Tlon-related is either process env with no settings-store counterpart, or process env that only _seeds_ a settings key's default:

-   **Env that seeds a settings default (edit the settings key to override it at runtime, not just the env):** `TLON_AUTO_DISCOVER` → `autoDiscoverChannels`; `TLON_GROUP_INVITE_ALLOWLIST` → `groupInviteAllowlist`; `TLON_OWNER_LISTEN`/`TLON_OWNER_LISTEN_DEFAULT`/`TLON_OWNER_LISTEN_DISABLED_CHANNELS`/`TLON_OWNER_LISTEN_ENABLED_CHANNELS` → the `ownerListen*` keys; `TLON_CHANNELS` → `groupChannels` (with a limit: a `groupChannels` edit can add or remove settings-managed channels, but can **never remove** a channel that came from `TLON_CHANNELS` — those stay monitored for the life of the process).
-   **Env-only, dashboard-invisible (no settings-store counterpart at all — a dashboard edit here genuinely does nothing):** notably `TLON_FREE_RESPONSE_CHANNELS` (unmentioned-message dispatch in named channels has no settings key on either harness), plus `TLON_ALLOWED_USERS`, `TLON_ALLOW_ALL_USERS`, `TLON_DM_ALLOWLIST` (the env var — distinct from the `dmAllowlist` settings key above), `TLON_REQUIRE_MENTION`, `TLON_BOT_MENTIONS`, `TLON_KNOWN_BOT_USERS`, `TLON_MAX_CONSECUTIVE_BOT_RESPONSES`, `TLON_HOME_CHANNEL`, `TLON_CONTEXT_MESSAGES`, `TLON_REACTION_LEVEL`, `TLON_REPLY_IN_THREAD`, `TLON_CLI`/`TLON_CLI_TIMEOUT`, `TLON_HOSTING`, `TLON_SKILL_PATH`, `TLON_SSE_READ_TIMEOUT_SECONDS`, `BRAVE_SEARCH_API_KEY`/`BRAVE_API_KEY`, the `TLON_TELEMETRY*` vars, the `TLON_GATEWAY_STATUS*` vars, and the connection credentials (`TLON_NODE_URL`, `TLON_NODE_ID`, `TLON_OWNER_SHIP`, and the `TLON_ACCESS_CODE`/`TLON_COOKIE` auth pair — one of the two is required, not both; each also accepts the older
    `TLON_SHIP_*`/`TLON_URL`/`TLON_SHIP`/`TLON_CODE`/`URBIT_*` aliases listed under [Configuration](#configuration)).

## Debug commands

`/tlon` is the owner-only debug namespace (intercepted deterministically, like `/owner-listen`):

-   `/tlon version` — what's running (below). `/tlon-version` is a legacy alias for the same output.
-   `/tlon status storage` — image-upload diagnostic: node URL, whether it looks hosted, the `TLON_HOSTING` override, storage service, S3 credentials, `%genuine` reachability, and the resolved upload path. (Mirrors the decision in `@tloncorp/api`'s `uploadFile`.)
-   `/tlon status binary` — identifies the exact `tlon` CLI the adapter runs: version, a sha256 content hash (two builds of the same version are distinguishable), size, and build time. Use it to confirm a deploy actually shipped a fresh binary.
-   `/tlon status telemetry [test]` — telemetry status; `test` sends and flushes a probe event (see [Telemetry](#telemetry)).

### Version

`/tlon version` reports what is running, one `Field: value` per line (chat reply italicizes keys and bolds values for scannability; the startup log is plain):

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

| event                                                    | when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TlonBot Reply Handled`                                  | per handled turn — OpenClaw-compatible properties (outcome, chatType, senderRole, counts, durations, model/provider, `toolUsage`) plus `dispatchReason`, a `cliUsage` rollup of CLI calls made in the turn, and `processingOutcome` from Hermes (so `outcome` distinguishes `responded`/`no_reply`/`error`/`cancelled`; turns that never complete surface as `abandoned`)                                                                                                                                                                                                                                                |
| `TlonBot CLI Call`                                       | per deliberate `tlon` CLI invocation — segmented as `commandRoot`/`commandAction`/`commandFlags` (flag names only, never values) plus the combined `command` label, with origin (`model_tool`/`invite_rsvp`/`version`/`adapter`), duration, returncode, error kind, and on failure a scrubbed `errorDetail` (the CLI's **full** stderr — all lines, ship-masked, capped only against pathological size — e.g. why an `upload` failed). Message-send plumbing (`delivery`/`control_plane`/`owner_notification`) is suppressed when successful — replies are already counted in Reply Handled — but still emits on failure |
| `TlonBot Error`                                          | failures at component level: `settings`, `approval`, `moderation`, `context_fetch`, `gateway_status` (incl. heartbeats), `presence`, `event_handler` (adapter bugs, kept distinct from stream errors), `connect`                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TlonBot Gateway Connected`                              | per connect, with version identity, CLI version, settings-state counts, and a content-free Hermes permission snapshot for cronjob/toolset/MCP startup gates                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `TlonBot Gateway Disconnected` / `TlonBot SSE Reconnect` | shutdowns (uptime) and stream reconnects (attempt, backoff, error type)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TlonBot Approval Event`                                 | `queued`/`renotified`/`allowed`/`rejected`/`banned`/`unbanned` with request type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `TlonBot Control Command`                                | which owner command ran (name only)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `TlonBot Telemetry Test`                                 | manual delivery check triggered by `/tlon status telemetry test`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Strictly content-free: no message text, no CLI arguments, no channel nests; ship ids are scrubbed from error detail. Per-message drop events are deliberately not emitted (volume without insight) — unauthorized senders surface as approval `queued` events instead.

### Debugging telemetry

When a deployment shows nothing in PostHog, work through the built-in diagnostics:

1. **Startup log** — the gateway logs the resolved telemetry state at construction, including the _reason_ when off: `[tlon] telemetry disabled: TLON_TELEMETRY is not enabled …` / `…API_KEY is not set` / `PostHog client init failed` (posthog package missing), or `[tlon] telemetry enabled (PostHog): key phc_…wxyz (47 chars), host default (https://us.i.posthog.com), events identify as owner ~sampel (bot ~palnet), debug off`.

    **Where these appear.** The gateway console (stderr) shows **WARNING and above by default** — INFO is hidden unless you run the gateway with `-v`. So the _failure_ states are logged at WARNING and show up unprompted: telemetry requested but unable to run (no key, posthog not installed), and enabled-but-ownerless (every event skipped). The healthy/off-by-default states are INFO, hidden on a default console. Regardless of console level, **all of it is always written to `~/.hermes/logs/agent.log`** (INFO+, profile-aware) — that file is the reliable place to read the full startup state. When telemetry is genuinely broken you'll see the WARNING on the console; to confirm a _working_ config without restarting, use `/tlon status telemetry` (below), which doesn't depend on log level at all.

2. **`/tlon status telemetry`** (owner-only, deterministic like `/tlon version`) — replies with live status: each setting's value _and source_ (`env TLON_TELEMETRY` vs `config telemetry` vs unset), masked API key, host, installed posthog SDK version, the distinct id events are sent as (the owner ship), whether the one-time identify was enqueued and as whom, events enqueued since gateway start, and any capture or delivery failures with ages.
3. **`/tlon status telemetry test`** — end-to-end verification: enqueues a `TlonBot Telemetry Test` event and synchronously flushes the SDK queue, then reports `Test event accepted by PostHog … as ~sampel` or the delivery error. This catches the failure modes that are otherwise invisible (malformed API key, wrong region host, blocked egress), because the posthog SDK's worker thread swallows upload errors. May take up to a minute when the network is down (SDK retries). Caveat: PostHog's ingestion endpoint accepts any well-formed batch and drops wrong-project keys later, so an accepted test that never appears in the dashboard means the key belongs to a different project.
4. **`TLON_TELEMETRY_DEBUG=true`** — logs every capture/identify enqueue at info level plus the posthog SDK's internal debug output, and elevates repeated delivery failures from debug to warning.

Delivery failures are also surfaced without debug mode: the adapter hooks the SDK's `on_error` callback and warns on the first failed batch (`[tlon] telemetry delivery to PostHog failed …`).

## Reactions

`TLON_REACTION_LEVEL` controls the model-facing reaction affordance. It defaults to `minimal`; `extensive` encourages more frequent natural reactions; `off` and `ack` both hide reaction hints and block `react`/`unreact` (the `ack` tier is retained as a reserved no-op for OpenClaw parity). At `minimal`/`extensive`, dispatched messages expose real wire ids in `[message id: …]` and `[thread root: …]` markers, and recent group context lines include their ids. The model uses `tlon posts react <nest> <post-id> <emoji>` for channels and `tlon dms react <ship> <author/id> <emoji>` for one-to-one DMs; reacting to a thread reply adds `--parent <thread-root-id>` (the DM parent must include its author).

Inbound channel reaction snapshots and DM reaction deltas are deduplicated in bounded in-memory state. An authorized reaction added to one of the bot's own posts wakes the model with the emoji and a cached/scry-fetched content snippet; channel targets that predate the gateway are classified by exact top-level or reply scries. A reaction on another post, and every removal, becomes a bounded passive note that is injected into the next authorized dispatch in that conversation without waking the model. Unauthorized reactions are dropped and never queue approvals. DM removals seen without a prior local add surface once through a tombstone, then deduplicate.

The cache and reaction state are intentionally process-local. After restart or bounded-state eviction, the first channel snapshot for a post can replay its current entries once. This is bounded best-effort observability rather than durable reaction history. The legacy emoji approval path is deliberately not implemented: current A2UI approval cards and `/allow`, `/reject`, and `/ban` replace it.

The `tlon` tool remains owner-only except that non-owner Tlon sessions may use `posts react|unreact` in their current channel or `dms react|unreact` in their current one-to-one DM, when reactions are enabled. They cannot target another conversation, mix the command family, or pass account/credential override flags.

## Reply Placement

Replies post **top-level** in the conversation (Tlon conversations are linear), and messages that arrive inside a thread are answered in that thread, attached to the thread root — this holds for both group channels and DMs (a reply to a DM-thread message lands in that thread, not the main DM). Set `TLON_REPLY_IN_THREAD=true` to instead start a thread on every triggering message.

## Group Message Context

When the bot wakes in a group channel it prepends recent history to the dispatched message so it can answer in context: the last `TLON_CONTEXT_MESSAGES` channel messages (default 20) for top-level wakes, or the parent post plus thread replies for thread wakes. Context fetches use the same `/channels/v4` scries as OpenClaw and degrade gracefully — on failure the bare message is dispatched. Set `TLON_CONTEXT_MESSAGES=0` to disable.

Hermes' Tlon home channel defaults to the explicit owner DM from `TLON_OWNER_SHIP`. Set `TLON_HOME_CHANNEL` only when cron, cross-platform deliveries, or startup notices should go somewhere else. `TLON_ALLOWED_USERS` and `TLON_DM_ALLOWLIST` are never used to infer ownership.

Tlon profile changes such as nickname, avatar, bio, status, and cover are owner-only in Tlon chat sessions. For avatar/cover changes, the model should upload a direct raster image URL or local file with `tlon upload` and then pass the returned uploaded URL to `tlon contacts update-profile`; source image URLs and SVGs should not be used as profile images.

`tlon upload` detects Tlon hosting from the node URL by default. Connections that reach their node over localhost/proxy fail that heuristic (the URL looks self-hosted), so set `TLON_HOSTING=true` to force the hosted (memex) upload path on such deployments. Run `/tlon status storage` to see which path a node resolves to and why.

The bot can also send images in messages: `tlon upload <direct-image-url>` then `tlon posts send <target> [caption] --image <uploaded-url>` (group DMs: `tlon dms send <club-id> … --image <url>`). The CLI reads the image's pixel dimensions from its bytes and attaches a story image block, so clients render it inline. Image sends are exempt from the current-conversation send block — the streaming reply path is text-only, so `--image` is the only way to deliver an image, including into the chat the bot is answering.

When `BRAVE_SEARCH_API_KEY` or `BRAVE_API_KEY` is configured, the adapter registers `image_search` under the Tlon toolset. Use this for user-requested images rather than asking the model to infer direct image URLs from ordinary web search results.

When `TLON_GATEWAY_STATUS` is enabled, the adapter pokes `%gateway-status` on connect, heartbeat, and disconnect. `TLON_GATEWAY_STATUS_OWNER` defaults to `TLON_OWNER_SHIP` when omitted.

The adapter reconnects its Eyre SSE channel when no bytes arrive for `TLON_SSE_READ_TIMEOUT_SECONDS`. This is meant to recover stale sleep/wake sockets and mirrors the byte timeout behavior in `@tloncorp/api`.
