# Activity and message history

Use the `tlon` tool to read; use `message` for ordinary outbound messages and replies. The examples below are tool arguments. Replace identifiers only with values returned by discovery or supplied by the user.

```json
{"command":"activity mentions --limit 10"}
{"command":"activity unreads"}
{"command":"channels dms"}
{"command":"channels groups"}
{"command":"messages dm ~ship --limit 20"}
{"command":"messages channel chat/~host/channel --limit 20"}
{"command":"messages search \"query\" --channel chat/~host/channel"}
```

Discover the target before fetching history when its identity is ambiguous. Channel nests, group flags, note IDs, and message IDs are different identifiers; preserve the exact value returned for that object. Message/post IDs may contain dots; DM post IDs can include an author prefix. Do not strip or reconstruct them.

For history pagination, surrounding context, reactions, edits, deletes (including thread replies), pins, or DM management, inspect `help messages`, `help posts`, or `help dms`, then the operation's help. Pinning and unpinning need a group admin or the channel's host ship; deleting another member's thread reply has the same requirement. CLI help also lists send/reply operations; ordinary sends and replies belong on `message` instead. Ship-targeted `dms send/reply` is blocked by the tool.

Mentions in `posts` and `dms` text: `~ship` mentions a person, `@role-id` a group role (the id as shown when reading, e.g. `@admin`, not its title) and `@all` every member; matching is case-insensitive. An unknown `@word` is refused; wrap it in backticks or write `\@word` to send it as text. DMs take `@all` only. Mentions notify only in plain paragraph text, not inside bold, quotes, headings, lists or tables, and edits never notify. Use `@all` only when the owner asks for it.

History and activity responses are bounded. A short or empty page does not prove that no older matching messages exist; use the supported pagination/search options before making an exhaustive claim.

To share a group, post, or note as a card, follow the reference rules in the skill's "Identity, delivery, and completion" section.

## Mute or change notification levels

```json
{"command":"activity mute ~host/group"}
{"command":"activity unmute chat/~host/channel"}
{"command":"activity volume chat/~host/channel soft"}
```

OpenClaw runs these as the configured owner unless `--self` or explicit credential flags are supplied, so they change the owner's notifications as seen in the owner's app. Change notifications only when asked. A thread is addressed by its channel and root post id. Report the level the command prints; if it says the change is not confirmed, say so instead of claiming success.
