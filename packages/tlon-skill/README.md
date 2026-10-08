# Tlon Skill

A CLI tool for interacting with Tlon/Urbit APIs.

## Installation and configuration

See the [operator guide](operator-guide.md) for installation, credential configuration, cookie caching, and multi-ship shell usage. Agents should start with [SKILL.md](SKILL.md).

## Usage

```bash
# List your groups
tlon channels groups

# Create a group channel
# (preferred alias; tlon groups add-channel still works)
tlon channels create ~host/group-slug "Projects" --kind chat

# Rename a channel
tlon channels rename chat/~host/project-updates "Team Updates"

# Work with shared group files as the current ship
tlon buckets list
tlon buckets upload buckets/~host/project-files ./plan.md -t text/markdown
tlon buckets read buckets/~host/project-files 12

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

-   **Activity**: Mentions, replies, unreads (with nicknames)
-   **Channels**: List DMs, group DMs, subscribed groups (nicknames shown), reader/writer permissions
-   **Buckets**: List, search, read, upload, move, and delete shared group files through short-lived capabilities
-   **Contacts**: List, get, update profiles
-   **Groups**: Create, join, invite/request flows, roles, privacy (member nicknames shown)
-   **Hooks**: Manage channel hooks (add, edit, delete, order, config, cron)
-   **Messages**: History, search (author nicknames shown)
-   **DMs**: Group DM send/reply, react, accept/decline
-   **Posts**: React, edit, delete
-   **Notes**: %notes notebooks (list, show, request, note-create, note-update, join, leave)
-   **Settings**: Hot-reload plugin config via settings-store

## Development

Use the Node version in `.tool-versions` and Bun `1.3.14`.

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

- [Operator guide](operator-guide.md): standalone CLI installation, credentials, caching, and shell usage.
- The runtime [skill](SKILL.md) routes agents to task references; exact syntax is available through `tlon help <command> [operation]`.

When adding a command family, update `scripts/command-catalog.json` and route it
to a task reference from `SKILL.md`. Keep argument parsing and exact flags in the
command's own help, and put shell setup or credential instructions in the
operator guide. The plugin's authorization allowlist remains a separate,
explicit review decision; adding catalog metadata must not grant tool access.
The skill-layout and tool-discovery tests check this contract.

## For Hosted Deployments

If you're running this in a hosted/K8s environment with additional features (workspace files, settings-store, click commands), see [@tloncorp/tlonbot](https://github.com/tloncorp/tlonbot).

## License

MIT

## Coordinated plugin release

The OpenClaw plugin imports the packaged command catalog introduced in tlon-skill 0.8.0. Publish the CLI package (including all platform binaries and task references) before publishing the dependent plugin. The local Docker harness installs a workspace package archive and binary, so testing does not require a registry release.
