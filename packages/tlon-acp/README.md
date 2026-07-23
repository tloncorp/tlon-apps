# `@tloncorp/tlon-acp`

A desktop or hosted worker that connects Tlon Messenger to any ACP-compatible agent.

```text
Tlon Messenger
      ↕
%acp Gall message bus
      ↕ authenticated HTTPS/SSE
tlon-acp-bot
      ↕ local ACP stdio
codex-acp or claude-agent-acp
```

The worker does not subscribe to `%chat` or `%channels` and does not send Messenger posts directly. `%acp` owns Messenger routing and delivery. ACP JSON-RPC stays on the worker machine.

The `%acp` Gall agent must be installed and running on the bot ship. The examples assume a bot ship named `~lux`.

## Build

Use Node 22:

```sh
nvm use 22
npm install --global pnpm@11.9.0

pnpm install --frozen-lockfile
pnpm build:acp
pnpm build:tlon-acp
```

## Worker directories

```sh
install -d -m 700 \
  "$HOME/.local/share/tlon-acp/lux" \
  "$HOME/.local/share/tlon-acp/lux/workspace"
```

The workspace must exist before starting the adapter. A missing working directory can produce `spawn <adapter> ENOENT` even when the executable is installed.

## Environment

Create a private file:

```sh
install -m 600 /dev/null "$HOME/.urbit/lux.env"
```

Add:

```sh
TLON_URL=http://127.0.0.1:8080
TLON_SHIP=lux
TLON_CODE=<access code from +code on lux>
TLON_ACP_OWNER=<owner ship>

ACP_WORKSPACE=$HOME/.local/share/tlon-acp/lux/workspace
ACP_STATE_FILE=$HOME/.local/share/tlon-acp/lux/sessions.json
ACP_ADAPTER_HOME=$HOME/.local/share/tlon-acp/lux
ACP_PERMISSION_POLICY=deny
```

When the desktop app connects to a remote ship, `TLON_URL` is that ship's HTTPS endpoint. Provider credentials remain on the desktop.

Load the file:

```sh
set -a
source "$HOME/.urbit/lux.env"
set +a
```

## Codex

Install the adapter under Node 22:

```sh
nvm use 22
npm install --global @agentclientprotocol/codex-acp@1.1.7
hash -r
command -v codex-acp
```

Use an isolated Codex home:

```sh
export CODEX_HOME="$HOME/.local/share/tlon-acp/lux/.codex"
install -d -m 700 "$CODEX_HOME"
codex login --device-auth
codex login status
```

Start the worker:

```sh
set -a
source "$HOME/.urbit/lux.env"
set +a

CODEX_ACP="$(command -v codex-acp)"
node packages/tlon-acp/dist/cli.js -- "$CODEX_ACP"
```

DM the bot ship from `TLON_ACP_OWNER`.

## Claude

Install the adapter:

```sh
nvm use 22
npm install --global @agentclientprotocol/claude-agent-acp@0.61.0
hash -r
command -v claude-agent-acp
```

An API key may be provided in the private environment file:

```sh
ANTHROPIC_API_KEY=<Anthropic API key>
```

For Claude account authentication:

```sh
set -a
source "$HOME/.urbit/lux.env"
set +a

HOME="$ACP_ADAPTER_HOME" claude-agent-acp --cli auth login --claudeai
```

Start the worker:

```sh
CLAUDE_ACP="$(command -v claude-agent-acp)"
node packages/tlon-acp/dist/cli.js -- "$CLAUDE_ACP"
```

## Routing

DMs are accepted from the owner and the optional DM allowlist:

```sh
TLON_ACP_DM_ALLOWLIST=<another ship>,<another ship>
```

Enable channels with channel nests and an author allowlist:

```sh
TLON_ACP_CHANNELS=chat/~host/general,chat/~host/bots
TLON_ACP_CHANNEL_ALLOWLIST=<owner ship>,<another ship>
```

Channel messages require a structured bot mention by default. The owner may speak without a mention in channels hosted by the owner or bot.

```sh
TLON_ACP_REQUIRE_MENTION=false
TLON_ACP_OWNER_LISTEN=false
```

The worker sends this routing policy to `%acp`; the Gall agent applies it to Messenger activity.

## Sessions and tools

Each DM or channel gets its own ACP session. Turns in a conversation are serialized, and session IDs are stored in `ACP_STATE_FILE`.

To expose the Tlon CLI:

```sh
npm install --global @tloncorp/tlon-skill@0.4.3
```

Then set:

```sh
TLON_ACP_TOOLS=cli
ACP_PERMISSION_POLICY=allow-once
```

Protocol-native MCP servers can be provided as an array in `ACP_MCP_SERVERS_JSON`.

## Process placement

The worker may run:

-   in a small desktop app on the user's computer;
-   as a development command;
-   in a dedicated per-bot pod.

No Node process is required on the ship server. Moving the worker into a pod does not change the `%acp` bus contract, and a different harness can consume the same queued Messenger requests.

Keep `TLON_CODE`, provider keys, and adapter credential directories private. Use separate session state, workspace, and credential directories for every bot.

## Troubleshooting

If `pnpm` fails under Node 20:

```sh
nvm use 22
npm install --global pnpm@11.9.0
```

For `spawn codex-acp ENOENT` or `spawn claude-agent-acp ENOENT`, check both the binary and workspace:

```sh
command -v codex-acp
command -v claude-agent-acp
test -d "$ACP_WORKSPACE"
```
