---
name: tlon
description: Read Tlon activity and message history; manage workspaces (Tlon groups), channels, Markdown notes, shared Bucket files, contacts, profiles, settings, and channel hooks; expose content publicly; share hosted-browser sessions and arrange secure form handoffs. Use for operating Tlon, not general product explanations or ordinary outbound messaging.
---

# Operate Tlon

Use the `tlon` tool for Tlon data and administration. Read the task reference below before an unfamiliar workflow. For explanations of the app, use `tlon-product-guide` if available.

In Tlon requests, **workspace** means a group: create, join, rename, invite, and list workspaces using `groups` commands. Explicit requests about the agent’s files or paths refer to its filesystem workspace instead.

## Invoke and discover

Tool arguments are argument strings, not shell scripts:

```json
{"command":"help"}
{"command":"help notes"}
{"command":"help notes note-create"}
```

`--help` and `-h` also work. This help covers only commands in the Tlon index; other tools such as `message`, `read`, and `write` have their own tool schemas, not Tlon subcommands. Exact flags live in command help; inspect it instead of guessing a verb or copying flags from a different operation. If CLI usage shows `tlon` at the start, omit it in the tool's command argument.

There is no shell expansion, pipe, redirection, or stdin transport. Use `write` to create a content file and pass its filename. Relative paths resolve in the active agent workspace, just like `read` and `write`. Do not put `$VARIABLE`, a heredoc, or inline Markdown in a filename argument.

## Choose the task reference

Resolve these links relative to this skill's discovered directory. Use the location in the available-skills listing; do not assume a particular installation path. Read only the reference needed for the task.

| Task | Reference |
| --- | --- |
| Read activity, search history, manage reactions or existing posts | [Reading](references/reading.md) |
| Workspaces (groups), membership, permissions, channels, public exposure | [Groups and channels](references/groups-channels.md) |
| Find notebooks and create/edit Markdown notes | [Notes](references/notes.md) |
| Shared group files and folders | [Buckets](references/buckets.md) |
| Upload media for messages or profiles | [Media](references/media.md) |
| Contacts, profile changes, bot settings | [Contacts and settings](references/contacts-settings.md) |
| Share a hosted browser or have the owner enter credentials, address, or card details | [Browser sharing and handoff](references/browser-handoff.md) |
| Channel hooks and advanced automation | [Hooks](references/hooks-workflow.md) |

## Identity, delivery, and completion

- Use returned group flags, channel nests, note IDs, and revisions. Display titles are not identifiers. Resolve ambiguous targets before writing.
- Credentials are supplied by the runtime. Use the current account; do not collect access codes, print credentials, or switch to the owner's identity to work around permissions. Some documented commands, such as invite-link retrieval, have an explicit owner-bound behavior.
- Use `message` for ordinary outbound messages and replies. For local media, upload first and pass the returned HTTPS URL; see the media reference.
- Use `groups create-owned` to create a group for a user and make them an admin. Read the groups reference for the identity requirements.
- Use `notes` for Markdown notebooks. Deprecated `%diary` management is unavailable through this tool; ask the owner to use `/migrate <diary-nest>` instead of attempting migration writes yourself.
- Do not use LaTeX delimiters in note bodies or messages; use plain text/Unicode or code blocks.
- Report a concrete failure if the task could not be completed. Verify the requested state before claiming success. A pending or host-confirmed write needs status/readback, not an immediate duplicate write.

## When discovery fails

If this skill or a linked reference is unavailable, `help` and command help still provide local syntax. Report a missing installation resource rather than inventing a path. A permission failure or unsupported command is not a reason to bypass the tool through a shell or raw API.
