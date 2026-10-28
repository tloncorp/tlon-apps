# Activity and message history

Use the `tlon` tool to read; use `message` for ordinary outbound messages and replies. The examples below are tool arguments. Replace identifiers only with values returned by discovery or supplied by the user.

```json
{"command":"activity mentions --limit 10"}
{"command":"activity unreads"}
{"command":"channels dms"}
{"command":"channels groups"}
{"command":"messages dm ~ship --limit 20"}
{"command":"messages channel chat/~host/channel --limit 20"}
{"command":"messages search \"query\""}
{"command":"messages search \"query\" --channel chat/~host/channel"}
```

`messages` prints each post as text: image, video, link and file URLs, gallery titles, table rows, and cited posts as `Ref:` paths; `--resolve-cites` adds the cited channel posts' text.

To find where something was said, search without `--channel`: it searches every DM, group DM, and joined chat and gallery channel at once and prints each hit under its channel's nest. It keeps the newest 5 hits per channel and 20 in all (`--per-channel N`, `--limit N`) and says when it left some out; repeat with `--channel <nest>` for every hit in one channel. If some channels could not be searched, the output starts by naming them, and their hits are missing. A search matches text, ignoring case, not meaning: try a synonym or a shorter word before concluding something was never said.

Discover the target before fetching history when its identity is ambiguous. Channel nests, group flags, note IDs, and message IDs are different identifiers; preserve the exact value returned for that object. Message/post IDs may contain dots; DM post IDs can include an author prefix. Do not strip or reconstruct them.

For history pagination, surrounding context, reactions, edits, deletes (including thread replies), pins, or DM management, inspect `help messages`, `help posts`, or `help dms`, then the operation's help. Pinning and unpinning need a group admin or the channel's host ship; deleting another member's thread reply has the same requirement. CLI help also lists send/reply operations; ordinary sends and replies belong on `message` instead. Ship-targeted `dms send/reply` is blocked by the tool.

To quote an existing post, add `--quote <channel> <post-id>` to `posts send` or `posts reply` (`--quote-parent <post-id>` when the quoted post is a thread reply); the message is then optional. To forward a post, use `posts forward`, which sends only its reference card. A quoted channel post becomes a reference card placed where the app places it; a quoted DM post becomes a `>` quote of its first line (the app quotes the whole text). Sources are posts in joined chat/ and heap/ channels (and, for quotes, DMs); targets are chat/ and heap/ channels, DMs and group DMs. The command reads the new post back: a channel target prints `Ref:`, a DM target prints `ID:`. If it says "not confirmed", check with the command it names before sending again. Members of the target who cannot read the source see an error card, as in the app. A separate `--quote` or `--quote-parent` token is always an option; to send it as text, put it inside the message argument.

```json
{"command":"posts send chat/~host/channel \"See this\" --quote chat/~host/other 170.141.184"}
{"command":"posts forward chat/~host/other 170.141.184 ~ship"}
```

Mentions in `posts` and `dms` text: `~ship` mentions a person, `@role-id` a group role (the id as shown when reading, e.g. `@admin`, not its title) and `@all` every member; matching is case-insensitive. An unknown `@word` is refused; wrap it in backticks or write `\@word` to send it as text. DMs take `@all` only. Mentions notify only in plain paragraph text, not inside bold, quotes, headings, lists or tables, and edits never notify. Use `@all` only when the owner asks for it.

History and activity responses are bounded. A short or empty page does not prove that no older matching messages exist; use the supported pagination/search options before making an exhaustive claim.

To share a group, post, or note as a card, follow the reference rules in the skill's "Identity, delivery, and completion" section.

## Mark chats read

```json
{"command":"activity mark-read ~ship"}
{"command":"activity mark-read chat/~host/channel"}
{"command":"activity mark-read ~host/group"}
{"command":"activity mark-read --all"}
```

Mark read only when the owner explicitly asks: under the OpenClaw harness these default to the owner, clearing the owner's badges in the owner's app, and `--self` (or explicit credential flags, where the tool description accepts them) selects another account; other harnesses run them as the current account (see the tool description). There is no undo. A group includes all its channels; a channel or DM includes its threads; `--all` includes group invites. A clear channel or group summary proves the posts and notifying replies are clear; the deep read also clears thread replies that did not notify, which the summary cannot show. Report what the command prints: "new activity arrived after the read" is not a failure, and "not confirmed" must be reported as such. A timeout means the outcome is unknown, not that the read failed: after one, the command confirms only unreads it saw clear, and reports "not confirmed" when nothing was visibly unread before, since summaries cannot show thread-only unreads. Rerunning is safe. Notes channels: mark their group read.

## Mute or change notification levels

```json
{"command":"activity mute ~host/group"}
{"command":"activity unmute chat/~host/channel"}
{"command":"activity volume chat/~host/channel soft"}
{"command":"activity volume base soft"}
{"command":"activity volume base"}
```

Under the OpenClaw harness these default to the owner, changing the owner's notifications as seen in the owner's app, and `--self` (or explicit credential flags, where the tool description accepts them) selects another account; other harnesses run them as the current account (see the tool description). Change notifications only when asked. A thread is addressed by its channel and root post id. Report the level the command prints; if it says the change is not confirmed, say so instead of claiming success.

`volume base` is the app-wide level under Settings → Notifications: `medium` (All DMs and workspace posts), `soft` (DMs, mentions, and replies only) or `hush` (Nothing). It covers push and in-app alerts; chats with their own level ignore it. Without a level it shows the current level. During TlonBot revival, the app may temporarily set base to hush; applying its staged restore level later can overwrite a CLI change.
