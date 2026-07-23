# `@tloncorp/tlon-acp`

Tlon-specific orchestration for any agent that implements the [Agent Client Protocol](https://agentclientprotocol.com/). The generic Gall/stdio bridge lives in `@tloncorp/acp`; this package adds Tlon Messenger routing, authorization, conversation sessions, and replies.

## How it fits together

```text
Tlon Messenger
  -> %acp Gall agent
  -> tlon-acp-bot
  -> codex-acp or claude-agent-acp
  -> Codex or Claude
```

`%acp` must be installed on the bot ship before starting the worker. The examples below assume a local bot ship named `~lux`, available at `http://127.0.0.1:8080`.

## Common setup

### 1. Use Node 22 and build the packages

NVM keeps global npm packages separate for each Node version. Install `pnpm` and the adapters after selecting Node 22:

```sh
nvm use 22
npm install --global pnpm@11.9.0

pnpm install --frozen-lockfile
pnpm build:acp
pnpm build:tlon-acp
```

### 2. Create the worker directories

The adapter is spawned with `ACP_WORKSPACE` as its working directory. Node may report `spawn <adapter> ENOENT` when this directory is missing, even if the adapter binary exists.

```sh
sudo install -d -o "$USER" -g "$(id -gn)" -m 700 \
  /var/lib/tlon-acp/lux \
  /var/lib/tlon-acp/lux/workspace
```

### 3. Create a private environment file

Create `$HOME/.urbit/lux.env` and limit it to the current user:

```sh
install -m 600 /dev/null "$HOME/.urbit/lux.env"
```

Add:

```sh
TLON_URL=http://127.0.0.1:8080
TLON_SHIP=lux
TLON_CODE=<access code from +code on lux>

# The ship allowed to control the bot through DMs.
TLON_ACP_OWNER=<owner ship>

ACP_CONNECTION=prod-agent
ACP_WORKSPACE=/var/lib/tlon-acp/lux/workspace
ACP_STATE_FILE=/var/lib/tlon-acp/lux/sessions.json
ACP_ADAPTER_HOME=/var/lib/tlon-acp/lux

# Deny agent tool requests until tool use is deliberately enabled.
ACP_PERMISSION_POLICY=deny
```

Do not commit this file. `TLON_CODE`, provider API keys, and cached provider credentials are secrets.

Load it with:

```sh
set -a
source "$HOME/.urbit/lux.env"
set +a
```

## Codex walkthrough

The pinned adapter includes a compatible Codex dependency, but authentication should be completed before starting `tlon-acp-bot`. Interactive ACP authentication is not yet exposed through the Tlon client.

### 1. Install the adapter

Run this after `nvm use 22` so the executable is installed into Node 22's global binary directory:

```sh
npm install --global @agentclientprotocol/codex-acp@1.1.7
hash -r
command -v codex-acp
command -v codex || npm install --global @openai/codex
```

### 2. Create and authenticate an isolated Codex home

Add this to `lux.env`:

```sh
CODEX_HOME=/var/lib/tlon-acp/lux/.codex
```

Then:

```sh
sudo install -d -o "$USER" -g "$(id -gn)" -m 700 \
  /var/lib/tlon-acp/lux/.codex

set -a
source "$HOME/.urbit/lux.env"
set +a

codex login --device-auth
codex login status
```

On a workstation with a browser, plain `codex login` also works. Codex keeps its configuration and cached authentication under `CODEX_HOME`; protect that directory like a password.

### 3. Start the Codex worker

Using the absolute adapter path avoids surprises caused by service or shell `PATH` differences:

```sh
nvm use 22
set -a
source "$HOME/.urbit/lux.env"
set +a

CODEX_ACP="$(command -v codex-acp)"
node packages/tlon-acp/dist/cli.js -- "$CODEX_ACP"
```

Successful startup prints:

```text
[tlon-acp] ready as ~lux on prod-agent (.../codex-acp)
```

DM `~lux` from `TLON_ACP_OWNER` to test it.

## Claude walkthrough

`claude-agent-acp` includes the Claude Agent SDK and its platform-specific Claude executable. It requires Node 22.

### 1. Install the adapter

```sh
nvm use 22
npm install --global @agentclientprotocol/claude-agent-acp@0.61.0
hash -r
command -v claude-agent-acp
```

If installation omitted optional dependencies, the adapter cannot find the native Claude executable. Reinstall without `--omit=optional`, or set `CLAUDE_CODE_EXECUTABLE` to an existing Claude executable.

### 2. Authenticate Claude

The simplest server setup is an Anthropic API key. Add it to `lux.env`:

```sh
ANTHROPIC_API_KEY=<Anthropic API key>
```

For a Claude subscription or Anthropic Console login, authenticate the bundled Claude CLI into the same isolated adapter home before starting the worker:

```sh
set -a
source "$HOME/.urbit/lux.env"
set +a

HOME="$ACP_ADAPTER_HOME" claude-agent-acp --cli auth login --claudeai
```

For Anthropic Console billing, replace `--claudeai` with `--console`. On a remote host where the direct login subcommand cannot complete, run:

```sh
HOME="$ACP_ADAPTER_HOME" claude-agent-acp --cli
```

and use `/login` in the interactive Claude terminal. Complete authentication before launching `tlon-acp-bot`.

### 3. Start the Claude worker

```sh
nvm use 22
set -a
source "$HOME/.urbit/lux.env"
set +a

CLAUDE_ACP="$(command -v claude-agent-acp)"
node packages/tlon-acp/dist/cli.js -- "$CLAUDE_ACP"
```

Successful startup prints:

```text
[tlon-acp] ready as ~lux on prod-agent (.../claude-agent-acp)
```

DM `~lux` from `TLON_ACP_OWNER` to test it.

## Tlon channels and tools

DMs are accepted only from the owner and `TLON_ACP_DM_ALLOWLIST`. To enable specific group channels, add comma-separated channel nests and allowed ships to `lux.env`:

```sh
TLON_ACP_CHANNELS=chat/~host/general,chat/~host/bots
TLON_ACP_CHANNEL_ALLOWLIST=<owner ship>,<another ship>
```

Channel messages require a bot mention by default. The owner may speak without a mention in channels hosted by the owner or bot. These gates can be changed with:

```sh
TLON_ACP_REQUIRE_MENTION=false
TLON_ACP_OWNER_LISTEN=false
```

To expose the existing `@tloncorp/tlon-skill` CLI to the agent:

```sh
npm install --global @tloncorp/tlon-skill@0.4.3
```

and add:

```sh
TLON_ACP_TOOLS=cli
ACP_PERMISSION_POLICY=allow-once
```

`allow-once` is automatically selected by the worker when the adapter asks for permission. Enable it only for a trusted owner and allowlisted channels, inside a dedicated workspace or container. Keep `deny` for a conversation-only bot.

Protocol-native MCP servers can instead be supplied as an ACP `mcpServers` array in `ACP_MCP_SERVERS_JSON`.

## Sessions

Each DM or channel gets its own ACP session. Turns in one conversation are serialized, and session IDs are persisted in `ACP_STATE_FILE`. The state file does not contain provider credentials.

Use a different `ACP_CONNECTION`, `ACP_STATE_FILE`, `ACP_ADAPTER_HOME`, and provider credential directory for every bot worker.

## Hosted credentials

`ACP_ADAPTER_HOME` sets `HOME` only for the adapter child process. In a hosted worker, mount one encrypted, per-bot credential volume at that absolute path and never reuse it for another customer. Existing provider credentials or API keys are appropriate for the first deployment phase.

A later browser auth broker should:

1. authenticate the user outside this worker;
2. materialize the adapter's credential files into that bot's encrypted credential volume;
3. atomically rotate the mount and restart only that bot worker.

Credentials never travel through `%acp` queues, Tlon messages, or the session state file. Turning adapter-specific browser launches into a hosted redirect or device-code flow belongs in the hosting control plane, not in this package.

## Troubleshooting

### `pnpm` fails under Node 20

Use Node 22 and install `pnpm` for that NVM version:

```sh
nvm use 22
npm install --global pnpm@11.9.0
```

### `spawn codex-acp ENOENT` or `spawn claude-agent-acp ENOENT`

Check both the executable and the working directory:

```sh
command -v codex-acp
command -v claude-agent-acp
test -d "$ACP_WORKSPACE"
```

NVM global binaries are version-specific. A missing `ACP_WORKSPACE` also produces the same Node spawn error. Using the adapter's absolute path after creating the workspace avoids both cases.
