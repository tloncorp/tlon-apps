# Tlon Skill

A CLI tool for interacting with Tlon/Urbit APIs.

## Installation

**npm:**
```bash
npm install @tloncorp/tlon-skill
```

**Direct download (no Node required):**
```bash
# macOS ARM64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-arm64/-/tlon-skill-darwin-arm64-0.4.0.tgz | tar -xz
mv package/tlon /usr/local/bin/

# macOS x64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-x64/-/tlon-skill-darwin-x64-0.4.0.tgz | tar -xz

# Linux x64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-linux-x64/-/tlon-skill-linux-x64-0.4.0.tgz | tar -xz

# Linux ARM64
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-linux-arm64/-/tlon-skill-linux-arm64-0.4.0.tgz | tar -xz
```

## Configuration

**Option 1: CLI flags (highest priority)**
```bash
# Cookie-based auth (fastest - ship parsed from cookie)
tlon --url https://your-ship.tlon.network --cookie "urbauth-~your-ship=0v..." contacts self

# Cookie-based auth with explicit ship and code fallback
tlon --url https://your-ship.tlon.network --ship ~your-ship \
  --cookie "urbauth-~your-ship=0v..." --code sampel-ticlyt-migfun-falmel contacts self

# Code-based auth (requires all three)
tlon --url https://your-ship.tlon.network --ship ~your-ship --code sampel-ticlyt-migfun-falmel contacts self

# Use skill-dir or cached credentials for one ship
tlon --ship ~your-ship contacts self

# Or use a config file
tlon --config ~/ships/my-ship.json contacts self
```

Valid CLI credential forms are `--config <file>`, `--url <url> --cookie <cookie>` with optional `--ship` and fallback `--code`, `--url <url> --ship <ship> --code <code>`, and `--ship <ship>` when available in `TLON_SKILL_DIR` or cache. Incomplete or conflicting credential flag sets fail locally instead of merging with environment variables.

Config file format:
```json
// Cookie-based (ship derived from cookie)
{"url": "https://your-ship.tlon.network", "cookie": "urbauth-~your-ship=0v..."}

// Code-based
{"url": "https://your-ship.tlon.network", "ship": "~your-ship", "code": "sampel-ticlyt-migfun-falmel"}
```

**Option 2: Environment variables**
```bash
# Cookie-based (ship derived from cookie)
export URBIT_URL="https://your-ship.tlon.network"
export URBIT_COOKIE="urbauth-~your-ship=0v..."

# Code-based
export URBIT_URL="https://your-ship.tlon.network"
export URBIT_SHIP="~your-ship"
export URBIT_CODE="sampel-ticlyt-migfun-falmel"
```

`URBIT_*` aliases take precedence over `TLON_*` aliases for the same field. Partial ambient credentials fail locally except ship-only env, which is used for `TLON_SHIP + TLON_SKILL_DIR` or cache lookup.

**Option 3: Skill directory**

When `TLON_SHIP` and `TLON_SKILL_DIR` are set, the CLI loads `ships/<ship>.json` from that skill directory before checking cached credentials.

**Option 4: OpenClaw config**

If you have OpenClaw configured with a Tlon channel, credentials are loaded automatically from JSON config. The default path is `~/.openclaw/openclaw.json`; `OPENCLAW_CONFIG` can point to an explicit JSON config path and is parsed as JSON regardless of extension.

**Resolution order:** CLI credential flags -> `TLON_CONFIG_FILE` -> URL + cookie env -> URL + ship + code env -> `TLON_SHIP + TLON_SKILL_DIR` -> ship-only cache lookup -> OpenClaw JSON -> single cached ship.

## Cookie Caching

The skill caches fresh auth cookies from code login and code fallback to `~/.tlon/cache/<ship>.json`. Provided-cookie flows validate the cookie but do not copy that cookie into cache.

```bash
# First time - auth and cache
$ tlon --url https://zod.tlon.network --ship ~zod --code abcd-efgh contacts self
Note: Credentials cached for ~zod. Next time run: tlon --ship ~zod <command>

# After that - select the cached ship
$ tlon --ship ~zod contacts self

# Multiple cached ships? Specify which one:
$ tlon --ship ~zod contacts self
```

Cache entries are ship- and URL-specific. Clear cache: `rm ~/.tlon/cache/*.json`

## Cookie vs Code Authentication

- **Cookie-based auth**: Uses a pre-authenticated session cookie. Faster since it skips login.
- **Code-based auth**: Performs a login request to get a fresh session cookie.

The ship name is embedded in the cookie (`urbauth-~ship=...`), so you don't need to specify it separately with cookie auth unless you want to override it. You can provide both cookie and code; the cookie is used first and the code is fallback if the cookie has expired.

## Multi-Ship Usage

If you have credentials for multiple ships, you can operate on behalf of any of them:

```bash
# Act as a different ship
tlon --config ~/ships/bot.json channels groups

# Or pass credentials directly
tlon --url https://bot.tlon.network --cookie "urbauth-~bot=0v..." contacts self
```

## Usage

```bash
# List your groups
tlon channels groups

# Create a group channel
# (preferred alias; tlon groups add-channel still works)
tlon channels create ~host/group-slug "Projects" --kind chat

# Rename a channel
tlon channels rename chat/~host/project-updates "Team Updates"

# Get recent mentions
tlon activity mentions --limit 10

# Fetch DM history
tlon messages dm ~sampel-palnet --limit 20

# Update your profile
tlon contacts update-profile --nickname "My Name"

# Create a group
tlon groups create "My Group" --description "A cool group"

# Create a group for a bot owner
tlon groups create-owned "My Group" --owner ~owner-ship --description "A cool group"

# Join a public or invited group; private groups without an invite request one
tlon groups join ~host/group-slug

# Manage group invite flow explicitly
tlon groups request-invite ~host/group-slug
tlon groups accept-invite ~host/group-slug
tlon groups reject-invite ~host/group-slug
```

## Features

- **Activity**: Mentions, replies, unreads (with nicknames)
- **Channels**: List DMs, group DMs, subscribed groups (nicknames shown), reader/writer permissions
- **Contacts**: List, get, update profiles
- **Groups**: Create, join, invite/request flows, roles, privacy (member nicknames shown)
- **Hooks**: Manage channel hooks (add, edit, delete, order, config, cron)
- **Messages**: History, search (author nicknames shown)
- **DMs**: Group DM send/reply, react, accept/decline
- **Posts**: React, edit, delete
- **Notebook**: Post to diary channels
- **Settings**: Hot-reload plugin config via settings-store

## Development

Use the Node version in `.tool-versions` and Bun `1.3.4`.

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build:smoke
npm run check
```

`npm run check` is the main local quality gate and is also run by CI. Coverage reporting is available with `npm run test:coverage`.

## Documentation

See [SKILL.md](SKILL.md) for full command reference.

## For Hosted Deployments

If you're running this in a hosted/K8s environment with additional features (workspace files, settings-store, click commands), see [@tloncorp/tlonbot](https://github.com/tloncorp/tlonbot).

## License

MIT
