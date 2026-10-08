# Tlon CLI operator guide

For humans installing or configuring the standalone CLI. The OpenClaw tool already receives account credentials from its runtime; agents should use the skill and should not collect secrets in chat.

## Installation

**npm (Node.js):**

```bash
npm install @tloncorp/tlon-skill
tlon channels groups
```

**Direct binary (no Node required):**

```bash
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-arm64/-/tlon-skill-darwin-arm64-<version>.tgz | tar -xz
./package/tlon channels groups
```

Replace `darwin-arm64` with `darwin-x64`, `linux-x64`, or `linux-arm64` as needed.

## Configuration

**CLI Flags (highest priority):**

```bash
# Cookie-based auth (fastest - ship parsed from cookie name)
tlon --url https://your-ship.tlon.network --cookie "urbauth-~your-ship=0v..." <command>

# Cookie-based auth with explicit ship and code fallback
tlon --url https://your-ship.tlon.network --ship ~your-ship \
  --cookie "urbauth-~your-ship=0v..." --code sampel-ticlyt-migfun-falmel <command>

# Code-based auth (requires url + ship + code)
tlon --url https://your-ship.tlon.network --ship ~your-ship --code sampel-ticlyt-migfun-falmel <command>

# Use skill-dir or cached credentials for one ship
tlon --ship ~your-ship <command>

# Or load from a JSON config file
tlon --config ~/ships/my-ship.json <command>
```

Valid CLI credential forms are `--config <file>`, `--url <url> --cookie <cookie>` with optional `--ship` and fallback `--code`, `--url <url> --ship <ship> --code <code>`, and `--ship <ship>` when available in `TLON_SKILL_DIR` or cache. Incomplete or conflicting credential flag sets fail locally instead of merging with environment variables.

Config file format:

```json
// Cookie-based (ship derived from cookie)
{"url": "...", "cookie": "urbauth-~ship=..."}

// Code-based
{"url": "...", "ship": "~...", "code": "..."}
```

**Environment Variables:**

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

**Skill directory:** When `TLON_SHIP` and `TLON_SKILL_DIR` are set, the CLI loads `ships/<ship>.json` from that skill directory before checking cached credentials.

**OpenClaw:** If configured with a Tlon channel, credentials load automatically from JSON config. The default path is `~/.openclaw/openclaw.json`; `OPENCLAW_CONFIG` can point to an explicit JSON config path and is parsed as JSON regardless of extension.

**Resolution order:** CLI credential flags → `TLON_CONFIG_FILE` → URL + cookie env → URL + ship + code env → `TLON_SHIP + TLON_SKILL_DIR` → ship-only cache lookup → OpenClaw JSON → single cached ship.

**Cookie vs Code:**

- **Cookie-based:** Uses pre-authenticated session cookie. Ship is parsed from the cookie name (`urbauth-~ship=...`). Fastest option.
- **Code-based:** Performs login to get a fresh session cookie. Requires URL + ship + code.

You can provide both cookie and code — cookie is used first, code serves as fallback if cookie expires.

## Cookie Caching

The skill caches fresh auth cookies from code login and code fallback to `~/.tlon/cache/<ship>.json`. Provided-cookie flows validate the cookie but do not copy that cookie into cache. This makes subsequent invocations much faster by skipping the login request.

**How it works:**

```bash
# First time - authenticates and caches
$ tlon --url https://zod.tlon.network --ship ~zod --code abcd-efgh contacts self
~zod
Note: Credentials cached for ~zod. Next time run: tlon --ship ~zod <command>

# After that - select the cached ship
$ tlon --ship ~zod contacts self
~zod

# With multiple cached ships - specify which one
$ tlon --ship ~zod contacts self
$ tlon --ship ~bus contacts self
```

**Cache behavior:**

- Cached cookies are URL-specific (won't use a cookie for the wrong host)
- If only one ship is cached, it's auto-selected (no flags needed)
- If multiple ships are cached, you'll be prompted to specify with `--ship`
- Code login and code fallback cache fresh cookies; provided-cookie flows do not copy cookies into cache

**Clear cache:** `rm ~/.tlon/cache/*.json`

## Multi-Ship Usage

If you have credentials for multiple ships, you can use this skill to operate on behalf of any of them. This is useful for:

- **Managing multiple identities** — switch between ships without changing environment variables
- **Bot operations** — act as a bot ship while authenticated as yourself
- **Moon management** — operate moons from their parent planet

Simply pass the target ship's credentials via CLI flags:

```bash
# Read channels as ~other-ship
tlon --url https://other-ship.tlon.network --ship ~other-ship --code their-access-code \
  channels groups

# Or keep credentials in config files
tlon --config ~/ships/bot.json channels groups
tlon --config ~/ships/moon.json contacts self
```


For exact command syntax, run `tlon help <command> [operation]`. Shell invocations include `tlon`; model-tool invocations omit it. Stdin, environment expansion, pipes, and redirections are shell-only.
