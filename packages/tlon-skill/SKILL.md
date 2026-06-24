---
name: tlon
description: Interact with Tlon/Urbit API. Use for reading activity, message history, contacts, channels, and groups. Also for group/channel administration, profile management, and exposing content to the clearweb.
---

# Tlon Skill

Use the `tlon` command for reading data, managing channels/groups/contacts, and administration.

## Hermes

When running as a Hermes plugin skill, the `tlon` tool is a wrapper around the
`tlon` CLI for reading data, administration, and management. Do **not** use it
to send replies or create posts.

For exact command syntax, use the command sections below or run
`tlon <subcommand> --help` through the tool.

When a Tlon user asks you to create a group for them, use
`tlon groups create-owned "Name" --owner ~requester [--description "..."]`.
This invites the requester and makes them an admin. Do not use plain
`tlon groups create` for user-requested groups; that creates a bot-owned group
that does not automatically include the requester.

For a normal reply in the current Tlon conversation, respond with final
assistant text and let Hermes deliver it through `TlonAdapter.send()`. To post
to a different channel or one-to-one DM (a proactive send), use `posts send`
with that target (`chat/~host/slug` for channels, `~ship` for one-to-one DMs).
Reserve `dms send <club-id>` for group DMs, whose club IDs start with `0v`.

Blocked in Hermes' `tlon` tool: plain-text `posts send`/`posts reply`/`dms
send`/`dms reply` targeting the **current** conversation (reply normally
instead). Image sends (`--image`) are allowed anywhere,
including the current conversation: `tlon upload <direct-image-url>`, then
`posts send <target> [caption] --image <uploaded-url>`.

## OpenClaw

When running as an OpenClaw skill, use the built-in `message` tool for sending outbound messages (DMs and channel posts). The `tlon` command is for reading data, administration, and management — not for sending messages. The `message` tool routes through the proper delivery infrastructure (threading, bot profile, rate limiting).

> **Removed: diary/notebook channels.** The `%diary` backend has been removed.
> `tlon notebook`, `--kind diary`, and any `diary/...` nest now fail with an
> explanatory error pointing at `%notes`. Use the `tlon notes` family for
> Markdown notebooks instead.

## Installation

**npm (Node.js):**

```bash
npm install @tloncorp/tlon-skill
tlon channels groups
```

**Direct binary (no Node required):**

```bash
curl -L https://registry.npmjs.org/@tloncorp/tlon-skill-darwin-arm64/-/tlon-skill-darwin-arm64-0.4.0.tgz | tar -xz
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

## Commands

Help and usage errors are handled locally before credential lookup, so `tlon <command> --help` works without a configured ship.

### Activity

Check recent notifications and unread counts. Ships are shown with nicknames when available.

```bash
tlon activity mentions --limit 10   # Recent mentions (max 25)
tlon activity replies --limit 10    # Recent replies (max 25)
tlon activity all --limit 10        # All recent activity (max 25)
tlon activity unreads               # Unread counts per channel
```

### Channels

List and manage channels. DMs show nicknames when available.

```bash
tlon channels dms                                          # List DM contacts (with nicknames)
tlon channels groups                                       # List subscribed groups
tlon channels all                                          # List everything
tlon channels info chat/~host/slug                         # Get channel details
tlon channels create ~host/slug "Projects" --kind chat     # Create a group channel
tlon channels rename chat/~host/slug "New Title"           # Rename a channel
tlon channels update chat/~host/slug --title "New Title"   # Update metadata
tlon channels delete chat/~host/slug                       # Delete a channel

# Writers (who can post)
tlon channels add-writers chat/~host/slug admin member     # Add write access
tlon channels del-writers chat/~host/slug member           # Remove write access

# Readers (who can view - requires group flag)
tlon channels add-readers ~host/group chat/~host/slug admin    # Restrict viewing
tlon channels del-readers ~host/group chat/~host/slug admin    # Open viewing
```

Help works for both the command and subcommands:

```bash
tlon channels --help
tlon channels create --help
tlon channels rename --help
```

Notes on permissions:

- Empty writers list = anyone in the group can post (default for chat)
- Empty readers list = anyone in the group can view (default)
- Roles must exist in the group (use `tlon groups add-role` first)

### Contacts

Manage contacts and profiles.

```bash
tlon contacts list                                   # List all contacts
tlon contacts self                                   # Get your own profile
tlon contacts get ~sampel                            # Get a contact's profile
tlon contacts sync ~ship1 ~ship2                     # Fetch/sync profiles
tlon contacts add ~sampel                            # Add a contact
tlon contacts remove ~sampel                         # Remove a contact
tlon contacts update-profile --nickname "My Name"    # Update your profile
```

Options: `--nickname`, `--bio`, `--status`, `--avatar`, `--cover`

### Groups

Full group management.

```bash
# Basics
tlon groups list                                         # List your groups
tlon groups info ~host/slug                              # Get group details
tlon groups create-owned "Name" --owner ~ship [--description "..."] # Create group for a user, invite owner, make owner admin
tlon groups create "Name" [--description "..."]          # Create a group
tlon groups join ~host/slug                              # Join public/invited group, or request invite if private
tlon groups request-invite ~host/slug                    # Request invite to a private group
tlon groups accept-invite ~host/slug                     # Accept an existing group invite
tlon groups reject-invite ~host/slug                     # Reject an existing group invite
tlon groups cancel-join ~host/slug                       # Cancel a pending join
tlon groups rescind-request ~host/slug                   # Cancel an invite request
tlon groups leave ~host/slug                             # Leave a group
tlon groups delete ~host/slug                            # Delete (host only)
tlon groups update ~host/slug --title "..." [--description "..."]

# Members (shown with nicknames when available)
tlon groups invite ~host/slug ~ship1 ~ship2              # Invite members
tlon groups revoke-invite ~host/slug ~ship1              # Revoke pending member invite
tlon groups kick ~host/slug ~ship1                       # Kick members
tlon groups ban ~host/slug ~ship1                        # Ban members
tlon groups unban ~host/slug ~ship1                      # Unban members
tlon groups accept-join ~host/slug ~ship1                # Approve a member join request
tlon groups reject-join ~host/slug ~ship1                # Deny a member join request
tlon groups set-privacy ~host/slug public|private|secret # Set privacy

# Roles
tlon groups add-role ~host/slug role-id --title "..."    # Create a role
tlon groups delete-role ~host/slug role-id               # Delete a role
tlon groups update-role ~host/slug role-id --title "..." # Update a role
tlon groups assign-role ~host/slug role-id ~ship1        # Assign role
tlon groups remove-role ~host/slug role-id ~ship1        # Remove role

# Admin
tlon groups promote ~host/slug ~ship1 [~ship2 ...]      # Promote member(s) to admin
tlon groups demote ~host/slug ~ship1 [~ship2 ...]       # Demote member(s) from admin

Roles vs Admin:
- Regular roles are for organizing members and controlling channel read/write permissions.
- Admin is a special privilege on top of a role. Admins can manage group settings,
  channels, members, and roles.
- `promote` creates an "admin" role (if one doesn't exist), grants it admin privileges,
  and assigns it to the specified members. `demote` removes that role from them.
- To grant admin to members who already share a role, use `set-admin` on that role
  via the backend directly (not yet exposed in the Tlon app UI).

# Channels
tlon groups add-channel ~host/slug "Name" [--kind chat|heap]
```

`tlon groups add-channel` remains supported, but for agent/tool use prefer the more discoverable channel-centric form:

```bash
tlon channels create ~host/slug "Projects" --kind chat
```

Help works here too:

```bash
tlon groups --help
tlon groups add-channel --help
```

Group format: `~host-ship/group-slug`

Join behavior:
- `join` first checks whether you are already a member, then checks foreign/unjoined group state for a valid invite.
- Invited groups and public groups use the backend join action.
- Private groups without an invite use the invite-request action.
- Secret groups require an invite.

### Hooks

Manage channel hooks — functions that run on triggers (posts, replies, reactions, crons).

```bash
# List and inspect
tlon hooks list                                          # List all hooks
tlon hooks get 0v1a.2b3c4                                # Get hook details and source

# Manage hooks
tlon hooks init my-hook --type on-post                   # Create starter template (on-post|cron|moderation)
tlon hooks add my-hook ./my-hook.hoon                    # Add a new hook from file
tlon hooks edit 0v1a.2b3c4 --name "New Name"             # Rename a hook
tlon hooks edit 0v1a.2b3c4 --src ./updated.hoon          # Update source
tlon hooks delete 0v1a.2b3c4                             # Delete a hook

# Configure for channels
tlon hooks order chat/~host/slug 0v1a 0v2b 0v3c          # Set execution order
tlon hooks config 0v1a chat/~host/slug key1=val1         # Configure hook instance

# Scheduled execution
tlon hooks cron 0v1a ~h1                                 # Run hourly (global)
tlon hooks cron 0v1a ~m30 --nest chat/~host/slug         # Run every 30m for channel
tlon hooks rest 0v1a                                     # Stop cron job
```

Notes:

- Hook IDs are @uv format (e.g., `0v1a.2b3c4...`)
- Schedules use @dr format: `~h1` (1 hour), `~m30` (30 minutes), `~d1` (1 day)
- Hooks run in order when triggered; use `order` to set priority
- Use `config` to pass channel-specific settings to a hook instance

**Writing Hooks:** See `references/hooks.md` for full documentation on writing hooks, including:

- Event types (`on-post`, `on-reply`, `cron`, `wake`)
- Bowl context (channel, group, config access)
- Effects (channel actions, group actions, scheduled wakes)
- Config handling with clam (`;;`)

**Examples:** See `references/hooks-examples/` for starter templates:

- `auto-react.hoon` — React to new posts with emoji
- `delete-old-posts.hoon` — Cron job to clean up old messages
- `word-filter.hoon` — Block posts containing banned words

### Messages

Read and search message history. Authors are shown with nicknames when available.

```bash
tlon messages dm ~sampel --limit 20                      # DM history (max 50)
tlon messages channel chat/~host/slug --limit 20         # Channel history (max 50)
tlon messages search "query" --channel chat/~host/slug   # Search messages
tlon messages context chat/~host/slug 170.141... --limit 5  # Messages around a post
tlon messages post chat/~host/slug 170.141...            # Fetch single post with replies
```

Options: `--limit N`, `--resolve-cites`

The `context` command fetches N messages before and after a given post ID — useful for
finding surrounding conversation when you have a post from search or activity.
For DMs, use the ship name as the channel: `tlon messages context ~sampel 170.141...`

The `post` command fetches a single post with its replies/thread. For DM posts,
pass `--author ~ship` (required for DM lookups).

**Tip:** Use `search` to find a message, then `context` with its ID to see the surrounding conversation.

### DMs

Manage direct messages — reactions, invites, and deletions.

```bash
# Management
tlon dms react ~sampel ~author/170.141... "👍"           # React to a DM
tlon dms unreact ~sampel ~author/170.141...              # Remove reaction
tlon dms delete ~sampel ~author/170.141...               # Delete a DM
tlon dms accept ~sampel                                  # Accept DM invite
tlon dms decline ~sampel                                 # Decline DM invite

# Group DM (club) sends
tlon dms send 0v5.abcde "hello"                          # Send to a group DM
tlon dms send 0v5.abcde "look" --image https://...       # Send with an image

# One-to-one proactive DMs use posts, not dms
tlon posts send ~sampel "hello"                           # Send to a 1:1 DM
```

### Expose

Publish Tlon content to the clearweb via the %expose agent.

```bash
tlon expose list                                         # List all exposed content
tlon expose show chat/~host/slug/170.141...              # Expose a post publicly
tlon expose hide chat/~host/slug/170.141...              # Hide an exposed post
tlon expose check heap/~host/gallery/170.141...          # Check if a post is exposed
tlon expose url heap/~host/gallery/170.141...            # Get the public URL
```

Cite path formats:

- Simplified: `chat/~host/channel/170.141...` (auto-expands)
- Full: `/1/chan/chat/~host/channel/msg/170.141...`

Channel kinds map to content types: chat→msg, heap→curio

### Posts

Manage channel posts (sends, reactions, edits, deletes).

```bash
tlon posts send chat/~host/slug "Hello"                  # Send a message
tlon posts send ~sampel "Hello"                          # Send a 1:1 DM
tlon posts send chat/~host/slug "Look" --image https://storage.../x.png # Send with an image
tlon posts send chat/~host/slug --image https://...      # Image only (no caption)
tlon posts react chat/~host/slug 170.141... "👍"         # React to a post
tlon posts unreact chat/~host/slug 170.141...            # Remove reaction
tlon posts edit chat/~host/slug 170.141... "New text"    # Edit a post's message text
tlon posts delete chat/~host/slug 170.141...             # Delete a post
```

Send `--image` takes a **direct** png/jpeg/gif/webp URL — normally the URL returned by `tlon upload` — and attaches it as an inline image block (dimensions are read from the image bytes). The message becomes an optional caption.

`posts edit` edits message text only. The former notebook-only
`--title`/`--image`/`--content` edit flags are removed (they refuse with an
explanatory error) along with diary/notebook channels.

### Notes

Manage %notes notebooks (Markdown-first). Notebooks are nests of the form
`notes/~host/name`; note bodies are plain Markdown (not Tlon Story).

```bash
tlon notes status                                        # Check %notes reachability
tlon notes list                                          # List your notebooks
tlon notes show notes/~host/name                         # Show a notebook
tlon notes notes notes/~host/name                        # List notes in a notebook
tlon notes note notes/~host/name 12                      # Show a note (with Markdown body)
tlon notes create "My Notebook"                          # Create a solo notebook
tlon notes note-create notes/~host/name root "Title" --markdown post.md   # New note at the notebook root
tlon notes note-create notes/~host/name 7 "Title" --stdin                 # New note in folder 7 from stdin
tlon notes note-update notes/~host/name 12 --body new.md --expected-revision 3
tlon notes note-rename notes/~host/name 12 "New Title"   # Rename a note
tlon notes note-move notes/~host/name 12 3               # Move a note into folder 3
tlon notes note-delete notes/~host/name 12               # Delete a note
tlon notes history notes/~host/name 12                   # Show a note's revision history
tlon notes folders notes/~host/name                      # List folders
tlon notes folder notes/~host/name 3                     # Show a folder
tlon notes folder-create notes/~host/name "Drafts" --parent 3   # Create a folder (root if no --parent)
tlon notes folder-rename notes/~host/name 4 "Archive"    # Rename a folder
tlon notes folder-move notes/~host/name 4 3              # Move a folder under parent 3
tlon notes folder-delete notes/~host/name 4 --recursive  # Delete a folder (--recursive for non-empty)
tlon notes members notes/~host/name                      # List notebook members
tlon notes join notes/~host/name                         # Join a notebook
tlon notes leave notes/~host/name                        # Leave a notebook
```

Note bodies come from exactly one of `--body <file>`, `--markdown <file>` (alias),
or `--stdin`. `note-create` places the note in a folder id, or `root` (resolved to
the notebook's root folder). `--expected-revision` on `note-update` is optional
(last-write-wins by default).

### Upload

Upload files to Tlon storage from a URL, local path, or stdin.

```bash
tlon upload https://example.com/image.png         # Upload from URL
tlon upload ./photo.jpg                            # Upload local file
tlon upload ~/Pictures/screenshot.png              # Upload with absolute path
tlon upload ./mystery-file -t image/webp           # Override content type
cat image.png | tlon upload --stdin -t image/png   # Upload from stdin
```

Options: `-t`/`--type` (override MIME type), `--stdin` (read from stdin)

Content type is auto-detected from file extension for local files. For stdin, `-t` is recommended (defaults to `application/octet-stream`).

Returns the uploaded URL for use in posts, profiles, etc.

### Settings (OpenClaw)

Manage OpenClaw's Tlon plugin config via Urbit settings-store. Changes apply immediately without gateway restart.

```bash
tlon settings get                                        # Show all settings
tlon settings set <key> <json-value>                     # Set a value
tlon settings delete <key>                               # Delete a setting

# DM allowlist
tlon settings allow-dm ~ship                             # Add to DM allowlist
tlon settings remove-dm ~ship                            # Remove from allowlist

# Channel controls
tlon settings allow-channel chat/~host/slug              # Add to watch list
tlon settings remove-channel chat/~host/slug             # Remove from watch list
tlon settings open-channel chat/~host/slug               # Set channel to open
tlon settings restrict-channel chat/~host/slug [~ship1]  # Set restricted

# Authorization
tlon settings authorize-ship ~ship                       # Add to default auth
tlon settings deauthorize-ship ~ship                     # Remove from auth
```

## Notes

- Ship names should include `~` prefix
- Post IDs are @ud format with dots (e.g. `170.141.184.507...`)
- DM post IDs include author prefix (`~ship/170.141...`)
- Channel nests: `<kind>/~<host>/<name>` (chat or heap)

## Limits

- Activity: max 25 items
- Messages: max 50 items
