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

For history pagination, surrounding context, reactions, edits, deletes, or DM management, inspect `help messages`, `help posts`, or `help dms`, then the operation's help. CLI help also lists send/reply operations; ordinary sends and replies belong on `message` instead. Ship-targeted `dms send/reply` is blocked by the tool.

History and activity responses are bounded. A short or empty page does not prove that no older matching messages exist; use the supported pagination/search options before making an exhaustive claim.

## Share a Tlon reference

Native reference paths render as cards in messages: `/1/group/<host>/<slug>` for groups, `/1/chan/<nest>/msg/<id>` for posts, and `/1/chan/notes/<host>/<name>/note/<id>` for notes. Prefer a returned `Ref:` path and preserve its identifiers. Put the reference after the sentence introducing it; malformed paths remain literal text.
