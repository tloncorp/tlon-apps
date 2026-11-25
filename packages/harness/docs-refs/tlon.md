# Tlon hand

The Tlon hand connects DMs, channels, and threads to Harness. It reads Groups'
Activity feed, checks who may use the bot, and delivers replies. The head runs
the conversations and holds provider credentials.

There are two independent surfaces:

- The reply hand admits authorized incoming messages and publishes final replies.
  Bound conversations receive destination-scoped tools.
- The ship-wide `tlon` tool performs explicitly requested social and content
  operations, including while automatic replies are disabled.

Use [ship-wide tools](#ship-wide-tlon-tool) for messaging and administration,
[workspace proposals](#workspace-proposals) for proposing a group in the owner's DM,
[Notes](#group-notes-bulk-imports-and-diary-migration) for notebooks and imports,
[hooks](#persistent-channel-hooks) for persistent native programs,
[publishing](#public-web-publishing) for public content,
[storage](#images-and-storage) for uploads, and
[scheduling](#conversation-tools-and-scheduled-work) for cron and reminders.
[Authority](#authority-and-conversation-scope) and
[delivery](#delivery-and-operation) apply across these workflows.

## Setup and public identity

Owner DMs support [work commands](work-control.md) and optional A2UI buttons.
Both let you manage work without opening Harness. Channels do not receive
owner-management controls.

Run `just setup SHIP ~owner` to set the owner and enable the hand. Trusted ships
and their tools are set through `harness/tlon/configure`.

**Bot profile** edits the ship's Contacts nickname and avatar. It refreshes
external changes without overwriting drafts, and waits for Contacts to confirm
saves. Empty fields clear those attributes; other fields, permissions, and
conversations stay unchanged.

Every message the hand writes (channel posts and replies, DMs and DM replies,
group DMs and their replies) carries the bot-profile author form with an empty
nickname and avatar, so other bots and the app know a bot wrote it. The app
still shows the name and avatar from the Contacts profile, and adds a bot
badge. Messages from `run_js`'s Tlon host APIs carry the same form. Older
messages with a bare-ship author keep it.

## Context Lens

Open **Context Lens** in a Harness conversation to inspect its runs. Each input
has an immutable Lens ID. The inspector shows journal context at first dispatch,
tool arguments and results, the reply, and hand delivery receipts. Reads do not
start inference. Provider reasoning, transport headers, and configured API keys
are excluded. Previews and lists are bounded; the full journal remains on ship.
The journal does not record per-tool or dispatch timestamps, so those timings
are unknown rather than estimated. Dynamic tool and skill catalogs are not
reconstructed from today's configuration.

To show these records in the owner's native Tlon Context Lens:

1. Install a Tlon version with Steward Lens support on both ships, and run
   `just setup SHIP ~owner`, which also enables owner sync.
2. On the owner ship, trust the bot: `:steward &steward-action-1 [%trust-bot ~bot]`.
   Replace `~bot` with the bot's ship name. Sponsorship alone does not grant trust.
3. The hand sets the bot's local Steward owner to its explicit owner whether or
   not owner sync is on, so owner-requested run retries reach Harness. While
   online, the hand also holds Steward's gateway lease, with or without owner
   sync, so Steward doesn't tell that owner the bot is offline. The lease lapses
   within 15 minutes of the hand stopping. A ship without Steward gets neither,
   and a hand without an owner holds no lease, since Steward refuses one. A
   hand with an owner watches Steward's gateway feed even while Steward is not
   running; Gall holds that watch until Steward starts, so a Steward that
   starts after the hand gets the owner and the lease when it starts.
4. Enable Tlon replies and send a new message. Accepted records make the native
   Lens available; reply attachments point to the run using its Lens ID and bot
   ship, without embedding context. Owner-DM work controls share the same blob.

Sync is off by default and applies to new Tlon inputs after enabling it. It sends
private records only to the explicit owner, not sibling administrators or chat
participants. Changing owners disables sync and clears the adapter's retry
cache; it never retargets previously captured records. Disabling sync does not
delete the owner's accepted records or the head's journal.

The adapter retains the latest 64 eligible runs for sync recovery. Updates are
idempotent Steward entries with bounded automatic attempts; **Retry sync**
retries pending records without rerunning inference or resending chat replies.
Sync health is separate from message delivery. Steward's run **Retry** action
admits a fresh, deduplicated input only for failed or interrupted runs that still
have current conversation authority and no active run. It uses current context
and tool permissions; it is not a replay of past external side effects.

## Ship-wide Tlon tool

The default-enabled **Tlon** grant exposes `tlon` with an `action` argument.
It works even when automatic replies are disabled. Actions cover messages,
contacts, groups, channels, roles, Notes, uploads, hooks, and publishing.
Call `{"action":"help"}` for arguments.

This grants access beyond the current chat, subject to native Tlon permissions.
Only the owner can use it; current-chat tools do not imply it. A ship other
than the owner, in a Tlon conversation or as a peer, is never offered it, and
granting it `tlon` has no effect.

Final answers return to the originating chat automatically. Use `send_dm` or
`send_channel` for separate messages elsewhere; optional `parent` selects a thread.
Both take `file` or `video`, a public HTTPS URL without credentials, recorded in
the post's blob as the app's typed entries with an unknown size. A gallery (heap)
post takes one attachment and an optional `title`; `link` instead posts a bare
link card to a gallery, with no text.

New groups default to secret (unlisted and invite-only), with no channels.
Create channels afterward; they are readable and writable by all group members.
For a group requested by another person, pass their explicit ship as `owner` to
`create_group`. One native command creates their admin seat and sends their
invitation. Harness's ship remains the host; the recipient must still join from
their own ship. A pre-created seat is not proof of a completed join. Existing
group names are rejected rather than replacing the group.
Mutation receipts confirm local acceptance only, not remote delivery or completed
joining. Pending calls become uncertain after one minute and are never retried
automatically, including after reload. Directory pages return at most 100 entries
within the tool's JSON byte budget. Continue with `next_offset`; these are live
views, so concurrent directory changes can shift positions.

`history` and `search_history` take exactly one of `ship` or `channel`; optional
`parent` selects a thread. Use exact `message_id` values from their results,
including the author prefix for DMs. Each page returns up to 20 messages, with
800-byte text previews and explicit truncation flags. Search scans at most 64
rows per page; follow `next_cursor` even when a page has no matches. Cursors are
bound to the destination, parent and query. `search_history` with neither `ship`
nor `channel` searches every DM, group DM and joined chat or gallery channel with
the native bounded search: the newest 500 messages and their replies in up to 40
chats, returning the 20 newest matches with where each was. `react`/`unreact` accept only messages
in the latest 20-message conversation/thread window. `list_dms` includes active
DMs and invitations, not archived conversations.

`get_profile` defaults to self, or reads a known contact when given `ship`.
`update_profile` edits only supplied nickname, bio, status, avatar or cover fields;
empty strings clear those fields. `update_group` and `update_channel` similarly
preserve omitted metadata and channel permissions; their `image` and `cover` take
a URL or a color, and an empty value keeps the current one. `refresh_contact`
re-subscribes to a peer's profile without adding them as a contact. These actions do not
change Harness ownership or grants. Adding a Tlon contact does not authorize it
to use the bot.

Group role and membership workflows use the same broad `tlon` grant:

- `list_roles`, `create_role`, `update_role`, `assign_role`, and `remove_role`
  manage ordinary roles and member assignments. New roles have no admin powers.
- `promote_member` assigns an existing admin-marked role (optionally selected
  with `role`). It never elevates a role merely because its name is `admin`.
  `demote_member` removes every admin-marked role in one command, preserving
  ordinary roles. The host cannot be demoted.
- `list_group_requests` shows pending/invited ships and join requests without
  exposing tokens or request bodies. `approve_join_request`,
  `reject_join_request`, `revoke_group_invite`, and `set_group_privacy` cover
  admission decisions.
- `list_group_invites` shows this ship's invitations and join progress.
  `request_group_invite`, `accept_group_invite`, `decline_group_invite`, and
  `cancel_group_join` operate on that foreign-group state.

Group administration requires native host or admin privileges. Refresh stale
state before a fresh request. Group changes do not change Harness ownership
or trusted-ship permissions.

The same grant also covers:

- Channel reader/writer role restrictions: `get_channel_permissions` and
  `add_channel_readers`, `remove_channel_readers`, `add_channel_writers`,
  `remove_channel_writers`. An empty restriction set means all group members;
  removing its final role opens access.
- Moderation: kick, ban/unban, and delete groups, channels or ordinary roles.
  Destructive calls require `confirm` to repeat the exact target ID after user
  authorization. The host is protected, only the host can delete a group, and
  admin-marked roles cannot be deleted through the tool.
- `get_message` reads a full post or reply in UTF-8-safe chunks. Search examines
  full text, not just the displayed preview. `history_around` reads five nearby
  messages on either side; `resolve_citation` follows native group, channel and
  Notes references without joining anything or executing a desk converter.
  `edit_message` preserves channel post/reply identity, author and metadata;
  it edits the bot's own messages, bare-ship or bot-profile. Native Tlon
  does not support editing DM or group-DM messages. `delete_message`
  requires exact-target confirmation. `accept_dm` and `decline_dm` resolve only
  pending invitations.
- `activity_inbox` reads all activity, mentions, replies or unread summaries.
  Group DMs have dedicated `list_clubs`, `get_club`, `club_history`,
  `search_club_history`, `send_club`, creation and invitation actions. A club is
  addressed by its native `0v` ID, never by an invented channel identifier.
  `get_club_message` reads full posts/replies in chunks; `delete_club_message`
  deletes this ship's own messages with exact-target confirmation. These are
  explicit tools; incoming club messages do not start automatic Harness replies.
- Native `%notes` notebooks, folders and Markdown notes: list/read, create,
  rename, move, delete, invitations, archived revisions and restoration.
  `edit_note` requires the revision returned by `get_note`. Writes wait for the
  correlated native Notes response, including conflict/permission errors;
  transport acknowledgement alone is not reported as a saved edit.
  If native notebook deletion times out after removing the book, the adapter
  checks the native directory and reports the observed absence, without retrying.
- Read state and notification levels of this ship's own account: `mark_read`
  for one DM, group DM, group or channel, or `scope: "all"`; `mute`, `unmute`,
  `set_notification_level` and `get_notification_levels`. Levels are the app's
  presets (loud, medium, soft, hush, default) with its limits: DMs take medium,
  hush or default, and the app-wide base takes medium, soft or hush. Muting a
  group keeps mentions and replies. Another ship's notifications, such as the
  owner's when Harness runs on a moon, are out of reach.
- `pin_message` and `unpin_message` write a channel's arranged order with the
  pinned root post first, for the channel host or a group admin.
  `forward_message` posts a reference card to a channel post or reply into a DM
  or a joined chat or gallery channel.
- One channel's membership: `join_channel` and `leave_channel` act on a chat or
  gallery channel without leaving its group.
- Group sections: `list_sections`, `create_section`, `rename_section`,
  `move_channel`, `order_sections`, and `delete_section` for an empty section
  other than the default. Each is one native command for the group host or an
  admin; `move_channel` appends a channel to another section, or with `index`
  reorders it within its own.
- `create_invite_link` asks `%reel` for a group's shareable link, then returns
  `https://invite.tlon.io/<token>` on a later call and enables `%grouper`.
  Private and secret groups need the host or an admin. Joining through someone
  else's link needs the invite provider's HTTP API and is not offered.
- Group buckets: `list_buckets`, `list_bucket_files`, `search_bucket_files`,
  `create_bucket`, `create_bucket_folder`, `rename_bucket_entry`,
  `move_bucket_entry`, `delete_bucket_folder` (empty folders) and
  `set_bucket_writers`. Changes go to this ship's `%buckets`, which forwards
  them to the host; a bucket's host must be a planet. File bytes move through
  Tlon's Memex service over HTTP, so reading, uploading and deleting files are
  left to the app.
- `upload_image` and `upload_file` reuse the existing upload implementation,
  storage settings, signing, durable receipts and bounded transfer handling.
  They add ship-wide access and non-image files. A `path` is a ship-local Clay
  `/desk/path/ext`, requires an additional matching Clay read grant, and never
  invokes a desk-defined converter. It is not a host operating-system path.
  The current-conversation `tlon_upload_image` is separately available.
  URL sources retain HTTPS/no-redirect restrictions; all uploads are capped at
  8 MiB and may be public under the configured storage policy.

### Workspace proposals

In the owner's own DM the same grant offers three more tools, so that a topic
which will outlast one reply gets a proposed workspace (a group) instead of one
made unasked. They are refused in channels, in DM threads, for other ships and
in scheduled runs.

Nothing about a card is saved. The DM holds the cards, the owner's taps and
the bot's answers, and the hand reads the newest 100 posts of the DM each time
it needs them. A card older than that is no longer known.

- `tlon_workspace_plan(intro, title, description, channels, task?)` posts the
  intro and a card listing the workspace, one to six channels (the first a
  chat) and an optional recurring task, with **Edit** and **Create** buttons.
  Nothing is created. The newest card in the DM is the live one; a tap on an
  older one creates nothing. The card shows the task's title and description;
  its schedule and prompt stay in the plan call the model made.
- A tap is the owner's DM post carrying the app's `tlon-a2ui-selection`
  receipt for a card; the same words typed are not a tap. The hand reads the
  post's blob only when its text is a card button's message, then appends a
  bracketed note to the message the model reads: **Create** says to call
  `tlon_workspace_create`, **Edit** says to ask what to change.
- A card's answer is the bot's reply after the card, up to the owner's next
  message. A card posted after the owner tapped **Edit** on the one before it
  keeps that card's answer.
- `tlon_workspace_create(proposal_id, group?)` runs only for a card the owner
  tapped **Create** on. Called with the card alone it returns the steps: make
  the group through the MCP server that acts on the owner's account, so the
  owner's ship hosts it, or with `create_group` and `owner` when no such
  server is granted, then its remaining channels. Called again with the new
  `group`, it requires that group to carry the card's title, to have no
  member, pending or invited ship or token for anyone but the owner and this
  ship, to belong to no other card, to make
  this ship an admin, and to have every listed channel. It then renames the
  group's first chat to the card's, makes the group secret, puts the channels
  in the card's order, posts the answer as the first message of that chat and
  posts the group's card in the DM. That post carries a
  `tlon-agent-post-marker` naming the card and the group, which is what makes
  the card created. It then reports the task to schedule with `cron_add`,
  without a run count so it repeats until cancelled, whose prompt starts
  with the task's title in brackets and posts to the workspace chat. A later call makes only the group changes still missing, so
  one Tlon rejected is retried, and otherwise makes nothing. The answer and
  the marker are not retried that way: if the chat rejects the answer but the
  marker lands, the card is created without its answer; if the answer lands
  but the marker does not, the next call posts the answer again.
- Every other top-level DM message from the owner, commands excepted, is
  admitted with a workspace rule as its hand context, the way a channel
  thread's public reference is: check `list_groups`, link a workspace that
  covers the topic, otherwise propose one, and no card for a topic already
  proposed or declined, small talk or one-off questions. The head records it
  beside the message, never as part of it, so the message's text, memory
  recall and the DM itself are unchanged. Like any context event it stays in
  the conversation's journal, about 550 bytes per message.
- `tlon_workspace_link(group, line)` posts one line and the card of a group
  this ship is in, for a topic an existing workspace already covers.

The group and its channels are made by the model's own calls between the two
`tlon_workspace_create` calls, so a failed group or channel step is resumed
by calling again,
and the model is told never to make a second group for a card. The task
follows the [scheduler](scheduling.md)'s limits: a UTC expression, at most 100
runs, and a closing line in the DM, the conversation that scheduled it.

### Group Notes, bulk imports and diary migration

`create_notebook(title, group?, readers?)` creates either a private standalone
notebook or a native group-linked Notes channel. Group creation requires live
group-admin authority. `readers` is a JSON-array string of existing group role
IDs; `[]` means all group members. Native Notes assigns the notebook flag and registers the channel.
`create_channel(group, title, kind="notes", readers?)` is an alias; omit `name`
and `description`, then use `update_channel` for listing metadata. Check the
returned `group_listing_verified`; if false, creation did happen, but inspect
`get_notebook` before writing instead of creating another notebook.

`get_notebook` includes the observed group listings and their readers.
`list_notebook_members` paginates native owner/editor/viewer records. These are
not an effective-access list: native Notes also rechecks group read access, and
revoked group members can remain in its membership map. Group reader edits use
the existing `add_channel_readers` / `remove_channel_readers` commands. Notes has
no independent channel writer-role set. `delete_channel` for a Notes channel
deletes the underlying notebook; native Notes removes its group listing too.
Standalone `set_notebook_visibility` requires exact notebook confirmation;
`public` lets others join as editors, so explicit sharing authorization is
required. Group-mode visibility changes are rejected; use group readers.

`plan_notes_import(notebook, folder_id, tree)` previews a flat or nested import.
`tree` is a JSON-array string, for example:

```json
[
  {"type":"note","title":"Overview","text":"# Markdown body"},
  {"type":"folder","title":"Reference","children":[
    {"type":"note","title":"Details","text":"More Markdown"}
  ]}
]
```

Then `import_notes` takes the same arguments plus the returned `revision` and
`confirm`. Plans bind the tree, folder, and destination contents. Any destination change
invalidates them. Imports add items without overwriting existing ones.
The entire payload is validated before the native action: at most 65,536 JSON
bytes, 100 total nodes, eight folder levels, 128-byte titles and 16,384-byte
Markdown bodies. The destination folder must exist. The tree supplies content directly; import does not read desktop or Clay files.

Diary migration is an explicit copy workflow:

1. Call `plan_notes_migration(channel)` to inspect the source and permissions.
2. Create a group notebook using the plan's group, suggested title and exact
   reader-role set.
3. Re-plan with `notebook` (and optionally `folder_id`; default is its root).
4. Call `migrate_notes` with the returned `revision` and `confirm`. When the
   plan warns `write_widening=true`, obtain explicit consent before adding
   `allow_write_widening="true"`.
5. Re-plan after each batch until `complete=true`.

The diary, group and target notebook must be locally hosted; the target must
be listed in the same group with identical reader roles. Before dispatch,
Harness additionally watches the native Notes snapshot to verify the notebook's
actual group affiliation, then rechecks the live tool grant and plan. A manually
added group listing alone cannot pass this check. Plans bind source
content, group/permission state and destination contents, so changes require a
new preview. Reader restrictions cannot be widened by migration. Notes lets
joined readers edit, so restricted diary writers or an open public group can
require the separate write-widening approval.

Each call copies at most 64 notes / 128 KiB. Complete source inspection is
bounded to 5,000 rows / 8 MiB of converted content, with explicit refusal for
oversized or unknown custom payloads rather than clipping or partial reads.
Destination inspection is capped at 10,000 notes; oversized permission/listing
responses fail explicitly rather than returning truncated JSON.
Deleted/stub rows are counted and skipped. Markdown preserves styled text,
lists, code, images and links; native dynamic references become readable
references. Original authors/timestamps and source citations are embedded in
the Markdown, since native Notes assigns new creation metadata. Comments,
reactions and original revision history stay in the original diary.

Migration never deletes or automatically renames the source. Exact prior
imports are skipped; changed source posts or edited/moved copies retaining
their provenance marker are conflicts, not silently overwritten. Removing
that marker makes the copy unrecognizable, so inspect before retrying after
manual edits. A native correlated result is required for writes; transport
acknowledgement is not completion. Never automatically repeat an uncertain
import: inspect the notebook and obtain a fresh plan first.
Harness serializes its native Notes mutations while a result is pending.

### Persistent channel hooks

`hook_template`, `list_hooks`, `get_hook`, and `get_hook_order` inspect native
`%channels-server` hooks. These are Hoon programs, not HTTP webhooks.
`add_hook`/`edit_hook` compile source; `set_hook_order` attaches an ordered list
to a locally hosted channel; `configure_hook` replaces its configuration.
`schedule_hook` starts a channel-specific or global repeating job, from one
minute through 365 days, with its first run after that interval. `stop_hook`
stops the specified job; `delete_hook` removes the hook and its native jobs.
An empty order detaches all hooks from that channel.

Every hook mutation requires explicit user authorization and an exact `confirm`
value: the title for creation, channel for ordering, or hook ID otherwise.
Edits also require the current revision. Source is limited to 16 KiB; configuration
is an 8 KiB JSON-object string with at most 64 string-valued entries. Hook lists
are paged; source reads are UTF-8-safe chunks. Oversized native configuration
reads fail explicitly instead of returning truncated JSON.

Only one Harness hook mutation runs at a time. The adapter subscribes before
dispatch and waits for the native result. Failed compilation can save source
without replacing the running program; inspect before retrying. Missing results
stay uncertain.

Hooks continue after the conversation ends or its grant is revoked. Stop jobs
or remove hooks explicitly. Native Hoon can stall the ship; hooks have no CPU sandbox.

### Public web publishing

`publish_post`/`unpublish_post` use native `%expose` for an exact, existing channel
post citation; `get_publication`/`list_publications` inspect exposure. Only root
chat, diary and heap posts are supported, not DMs, replies, arbitrary desks or
groups. Publishing also advertises the citation through native Contacts/profile
integration. It can make private group content public, so obtain explicit approval
for the exact content and repeat its full citation in `confirm`.
`get_publication` also accepts `channel` plus a history `message_id` to derive
that citation without publishing. Native citations contain ungrouped decimal
post IDs, unlike dotted IDs in native scry paths.
Native `%expose` can refresh the public page when the post changes; later edits
to an exposed post can therefore become public too.

`publish_note`/`unpublish_note` manage native Notes public HTML snapshots, with
`get_note_publication` and `list_published_notes` for inspection. Confirmation is
`<notebook>/note/<note_id>`; publication also requires the current note revision.
The default page displays escaped Markdown source. Optional `html` supplies a
well-formed inert fragment, at most 16 KiB, for formatted output. The adapter
parses and reserializes it, rejecting scripts, CSS, event handlers, forms,
embedded frames, SVG and non-HTTP(S) links/images. Pages include a restrictive
CSP because native Notes serves them on the ship's own origin.

Returned paths are relative to the ship's HTTP origin; the tool does not invent
a public domain or configure hosting. Public reachability depends on existing
hosting. Notes publications are snapshots, not live Markdown; republish after
editing. Unpublishing removes local serving but cannot erase third-party copies
or caches. Neither form grants access to other unpublished ship content.

## Models and failures

Tlon uses the same providers and credentials as every other Harness client.
New conversations snapshot **Settings → Defaults**. Changing defaults does not
retroactively change an existing DM or thread.

**Apply defaults to Tlon conversations** copies the default endpoint, model,
headers, and context limit while preserving instructions, history, and tools.
You can also edit each conversation's settings. Changes affect subsequent
requests, not active or failed work. Send another message after fixing a failure.

Replies describe provider failures without exposing raw errors publicly.
When the loop guard stops a turn, after four failed tool calls in a row or 24
model turns without an answer, the reply says the bot stopped and asks for a
new message. Open the Harness conversation for details. For a `401`, check that conversation's
endpoint and credential. Refreshing the page does not retry inference.
A message whose request is too large for the model and cannot be made to fit
usually gets one reply saying it was left out; the next message is answered
without it. When Harness itself refuses to compact because an earlier exchange
or a pending group of summaries is too large for the summary model, the message
is kept and the reply suggests a larger-context model.

Send `/help` for the shared [conversation commands](acp.md#conversation-commands).
Mention rules still apply. `/stop` interrupts work and clears queued inputs;
other commands wait for the turn to finish.

`/work` manages tasks and documents in chat. Protected owner operations require
an owner DM; other actors use their Workspace and document permissions, except
in a channel, where only the owner may use it.
See [work commands](work-control.md).

### Shared memory

Relevant durable facts are recalled automatically. A fact learned in a
channel is seen everywhere; one learned in a DM, only in that DM and the
owner's DM, except that the owner's general preferences are recalled
everywhere. Use `/remember preference Keep replies short.` to save a fact,
`/memory [query]` to inspect memories, and `/forget preference` to forget one.
Use `/memory off` for a conversation that should neither recall nor capture
shared facts. Model replies containing commands do not execute them.

In mention-only channels, select the bot's native mention first, then type the
plain slash command in the same paragraph—for example, **@Bot /memory**. The
addressing prefix is removed before the shared command interpreter runs; it does
not bypass sender or mention authorization. Plain-text ship spellings, other
ships' mentions, formatted command text and multi-paragraph messages do not use
this shortcut. DMs and replies to the bot's own channel posts do not need it.

Memories retain their source actor. A save from the owner's DM onto a channel
fact makes it private, and the reply says so. They survive compaction and
reloads. Forgetting leaves historical copies. See
[who sees a fact](context-and-memory.md#who-sees-a-fact).

### One companion, scoped conversations

The ship is the companion's identity. Contacts supplies its name and avatar;
each conversation keeps its own instructions and model.

Preferences retain their source actor. Recall gives the owner's general
preferences in every conversation, then the speaker's own.
Skills are an owner-managed shared instruction library, not personal memory.
Social conversations and their descendants cannot write, stage or publish into
that library, regardless of saved tool grants. Every Tlon conversation is social
from its creation, before anyone has written in it, so a schedule made there
before its first message holds the same tools after it. Only an administrative
turn escapes this: the owner's in the owner's DM, or the operator's own local
prompt. An operator can deliberately install reusable instructions outside a
social conversation.

Ordinary message admission captures public reference material for the turn,
separately from the current input. For a channel thread it is the native parent
and up to eight recent replies. For a top-level channel conversation it is up
to twenty recent top-level posts. The message being admitted is left out, and
so is any other message still waiting to be admitted to the same conversation:
each arrives as an input of its own. The snapshot records destination, message
IDs, ships, timestamps and clipped text. It never reads another actor's Harness
log or notes, and it grants no execution authority. Its encoded budget is 6 KB;
each message has the history reader's 800-byte text limit. A snapshot over
budget omits its oldest messages. Commands do not retrieve or interpret this
material. DMs receive no automatic cross-message context.

A ship that has a Contacts nickname is shown with it, as `~ship (Nickname)`:
in the prefix that names a channel message's speaker, and as the author of each
message in the reference. The nickname loses control characters, parentheses
and square brackets, and is cut to 50 bytes. A DM message has no prefix, so a
DM turn whose partner has a nickname gets a one-line contact reference with it.
A name is a label the ship chose for itself, and the channel instructions and
each reference say so; identity and authority stay with the ship.

## Thinking and tool activity

The public “Bot · Offline” badge reads the `bot-liveness` Contacts field.
The native hand publishes `{"v":1,"state":"online"}` when it is enabled,
its Activity subscription is acknowledged, and its head subscription is live;
otherwise it publishes `offline`. Adapter events reconcile only that field,
preserving the rest of the profile and skipping unchanged claims. Reload and
reconnection repair the claim. A failed Contacts read or edit retries on the
next adapter event without blocking chat or creating a nack loop. If the whole
ship stops, peers retain the last published claim until the ship returns.

The same reconciliation publishes the `bot-info` claim that identifies the
runtime to the app (`docs/bot-info.md`):
`{"v":1,"harness":"harness","version":"<version>"}`, whatever the hand's
readiness. The version is `version` in `desk/lib/harness-defaults.hoon`, which
the ACP agent info also reports; `package.json` repeats it for the shared bot
E2E, and `tests-js/distribution.test.mjs` keeps the two equal. Both claims
share one Contacts read and, when either differs, one `%self` edit.

Chat computing indicators use `%presence-action-1` and the
`tlon.computing-status.v1` display payload, matching the versioned Groups
Presence protocol.
The adapter publishes “Thinking...” or named tool activity (for example,
“Searching the web” or “Reading chat history”) in the DM/channel context.
Only unfinished calls in the latest tool batch contribute. Names are restricted
to the native catalog; unknown calls get a generic label. No prompts, arguments,
MCP server/tool identifiers, results, or reasoning content are included.
The status carries `thinking: true` for as long as the context has work;
tool activity is carried by `toolCalls` and the display text, because
Messenger hides a status whose `thinking` is false.

Activity is aggregated across actors and threads sharing a context. One thread
finishing cannot clear another's indicator. Head events update tool/phase changes
and clear settled or revoked work. A lease deadline renews active presence every
ten seconds. Leases expire after thirty seconds if the adapter stops. Presence
is presentation only: it neither admits work nor determines settlement.

## Images and storage

Standalone `![description](https://image-url)` lines become Story images in
DMs, channels, and threads. Fenced examples stay literal. Images travel through
the normal reply ledger.

`tlon_upload_image` downloads a public image and uploads it using Tlon's storage
settings. It returns a URL; the final reply can include it as an image.

Configure custom S3 credentials, bucket, region, and optional public URL base in
Tlon, or select hosted presigned-URL storage with its `service` toggle. Harness
needs no separate media setup. Custom storage's public readability is the
operator's responsibility.

The ship downloads PNG, JPEG, GIF and WebP directly through Iris, checks their
file signatures and MIME types, and limits them to 8 MiB. Source URLs must be
HTTPS with a qualified DNS hostname, no credentials, custom port, fragment or
local-name suffix. IP literals are rejected. Downloads send no ship credentials.
All HTTP requests disable redirects and transport retries. Iris does not expose
DNS-answer validation or connection pinning, so hostname checks do not guarantee
that a domain resolves to a public IP; this is not a private-network isolation
boundary. There are at most four pending uploads and a one-minute call deadline.

Hosted mode reads the ship's `%genuine` identity and asks the fixed
`https://memex.tlon.network/v1/<ship>/upload` endpoint for an upload URL, with the
exact file name, byte count and MIME type. Memex owns cloud authentication/signing;
no static cloud keys or workload-identity credentials are copied into Harness.
The returned GCS upload URL is used unchanged, with matching content type and
cache-control headers. Only its separate public file URL reaches the model.
The identity token is never sent to the image source or storage PUT. Arbitrary
custom presigning endpoints are not supported, even if `presignedUrl` is populated.

The hand checks current conversation authority and unchanged storage credentials
before each PUT. A positive `AccessControlListNotSupported` rejection permits
one retry without the signed `public-read` ACL, using the same object key. Other
ACL incompatibilities are reported as failures, not blindly retried.
DigitalOcean Spaces also receives a signed `x-amz-acl: public-read` header;
its uploads cannot rely on the ACL query parameter alone. The owner maintenance
script `tests-js/spaces-media-repair.mjs` inspects this ship's `harness-*` image
objects, with `--apply` limited to repairing owner-only ACLs. It never changes
bucket policy or replaces custom object grants.
Reloads and permission changes retire unfinished downloads; a dispatched PUT
without acceptance evidence stays uncertain and is never automatically repeated.
An interrupted hosted URL request is also uncertain: the broker may have allocated
quota, but the result explicitly states that no image PUT was sent.
Already dispatched storage writes cannot be undone by revoking permissions.
An accepted upload does not guarantee public readability or remote message delivery.

The live fixture is `tests-js/tlon-media-conformance.mjs`; it requires
`MEDIA_TEST_STORAGE=1`, the usual two-ship test variables, and optionally
`SHIP_PIER` for adapter suspension/reload checks. It downloads a real public
image through the ship, temporarily configures a local independently verifying
S3 endpoint, and restores the test ship's storage configuration.

## Authority and conversation scope

Unpermissioned senders are silently ignored: no reply, no permission-denied DM,
no model call and no automatic trust grant. This covers DM invitations,
existing DMs, channel mentions and replies to the bot. A local, rate-limited
audit entry records addressed attempts without accepting the invitation or
messaging the sender.

- New owner conversations inherit the tools in **Settings → Defaults**, not the
  entire catalog. Existing conversations keep their configured grants. Ownership
  still permits conversation admission and invitation acceptance without tools.
  An owner turn in the owner's own DM with the bot has administrative authority
  and gets the live catalog whatever the saved tools say, except `run_js`, which
  needs `code` saved on the conversation. In a channel, the saved tools limit the
  owner too.
- Trusted ships can chat with no tools; each grant is explicit.
  MCP entries grant individual registered server IDs, for example
  `{"mcp":"calendar"}` in the `tools` array. Registering another server never
  adds it to trusted actors' grants. A granted server permits all of its tools.
- Only the owner schedules work. Trusted and allowed ships are not offered the
  scheduling tools, whatever their grants, and a job whose actor is not the
  owner is paused.
- A ship other than the owner, in a Tlon conversation or as a peer, is never
  offered `tlon` or `run_js`, and a call to either is refused, whatever its
  grants say. Granting either to it has no effect. A session bound to another
  hand gets the tools its adapter configures (see
  [hands](hands.md#binding-and-authority)).
- Other ships and the bot's own messages do not enter inference. The bot
  knows its own messages by the author's ship, whichever author form they carry.
- A channel post or reply whose author carries a bot profile, as OpenClaw and
  Hermes bots write theirs, is a bot's message. On admission the hand reads
  that one message from local `%channels`, a bounded page and an exact-key
  lookup, and records it in the activity feed as `bot-message`. It is admitted
  and answered like any other message, until bots answer each other: when the
  three newest admitted messages in a conversation (a channel's top level, or
  one thread) are all bots' messages, the hand reads past each further bot's
  message there. It makes no job, starts no model call and posts nothing; the
  first message read past adds one `bot-limit` entry to the activity feed. An
  admitted message from a person ends the run, and bots are answered again.
  Messages the hand ignores for other reasons neither count nor end a run.
  The run is read from the 128-entry activity feed, so it is remembered only
  while the feed holds those three entries; once later entries of any kind
  push them out, bots' messages are admitted again. A message the hand can no
  longer read there (the channel left, the message gone, or its thread's
  parent deleted) is recorded as `message`, and counts as a person's.
- Group invitations are accepted only when sent by the owner. DM invitations
  from the owner, a trusted ship or an allowed ship are accepted. An invitation
  still pending when its sender gains access is accepted at that point, or when
  the adapter next loads; messages the sender sent before it gained access are
  not answered.
- Joining a group subscribes to its readable channels. When the bot's own group
  roles change, the hand rechecks native read permissions and joins accessible
  channels that are not already joined. Role notifications do not grant chat
  participants any Harness permissions; disabled hands do not reconcile.
- Channels require a mention by default. Replies to the bot's own posts count
  as addressed; DMs do not require mentions. Turn the requirement off to answer
  every message from allowed actors in channels the ship has joined.
- The exact destination determines the stable conversation: a DM, a channel
  and each thread in either have one conversation each. Every admitted speaker
  in a channel shares its conversation, and each message there reaches the
  model prefixed with its speaker's ship, the ship's nickname in parentheses
  when it has one, and a colon. Text the head parses as
  a command, such as `/stop`, stays as written so it is still a command; other
  text that starts with a slash, such as a path, is prefixed. A channel does not share the owner's
  private DM transcript, and a speaker never gets another speaker's grants.
  Channel answers are still public to that channel's members: granting file,
  web, skills, peer, or MCP access can expose whatever those tools can read.
- A channel conversation's saved tools are the owner's Defaults, whoever spoke
  there first; each turn's speaker ceiling narrows them. A DM's are its
  partner's grants.
- A channel conversation's settings, thread included, are the owner's. Another
  speaker there may still use `/help`, `/status`, `/context`, `/model` and
  `/memory` with no argument or a query, and `/stop` for their own work, but
  `/model` with an argument, `/compact`, `/memory on` or `off`, `/remember`,
  `/forget` and `/work` get a reply that only the owner can change the
  conversation's settings; they reach no model and change nothing. The head
  asks the adapter whether a speaker may, as it asks for authority. A DM's
  partner keeps every command, as do the operator's local prompts.

Authority is decided per speaker. For each turn the head asks the adapter about
the actor of the conversation's running input, and for scheduled work about the
schedule's actor. The adapter answers from that speaker's own access to the
conversation's destination: the owner has no ceiling, any other ship's ceiling
comes from its own grants and, in a channel, its native read permission, and a
ship with no access there gets no authority. A speaker never receives another
speaker's tools.

- A DM answers for its partner. The partner, the operator's own local or ACP
  prompt and a question with no speaker all get the partner's authority; any
  other speaker gets none.
- In a channel, the operator's own local or ACP prompt, which the head passes
  as the bot's own ship only after proving it is local, has the owner's
  authority. With no speaker known, as for a timer, a channel conversation
  answers live with only Tlon read and write, never the owner's authority.
- A scheduled run with no speaker answers for its schedule's actor.
- A channel conversation never has administrative authority.

Admission checks each message's speaker, including its native read permission
in a channel, even when the conversation's route is already set up. Context,
history and lens sync ask only whether the conversation itself is live: Tlon is
enabled, its route is ready, any schedule still holds and the channel does not
have replies turned off.

Permission changes retire only affected authorization routes. Adding an unrelated
trusted actor leaves existing conversations, in-flight work, notes, saved model
settings and schedules alone. Changing the mention requirement or a channel's
rule affects that channel's routes, not DMs. Changing an actor's role or
effective grants retires that actor's DM route; in a channel it keeps the route
and binding, and cancels only that actor's running and queued work there.
Grant order alone is not a revocation. Disabling Tlon affects every route.

Affected queued/running work is cancelled, old bindings are disabled, native
timers and delegated work are fenced, and source schedules are paused until
explicitly rescheduled. The head retains its transcript, shared knowledge and chosen
configuration. New authorized input resumes that same head only after cancellation
and a tools-only configuration update have been acknowledged, using a fresh
binding. Old publications cannot move to the new binding. Actor-specific admission
cutoffs reject queued pre-grant messages without dropping unrelated input.

Publication checks the exact current binding again after claiming, before
sending, and the reply's speaker: it is sent only while that speaker is still
granted there and if the speaker's input came after the speaker's latest
permission change, or for a sibling moon's owner the latest change to sibling
ownership, so a reply to a speaker revoked mid-turn, or a stale one
after a later re-grant, is not published. Async callbacks and self-dispatched work carry request generations,
so reusing a tool-call ID cannot revive an old request. Previously emitted network
operations cannot be undone; their receipts and uncertainty remain evidence.
Saving unchanged policy leaves routes and sessions alone. Conversation heads
remain distinct from authorization bindings and scheduled-run sessions.

`tests-js/tlon-continuity-conformance.mjs` exercises native DM/channel threads,
unrelated and affected permission edits, notes, chosen settings, timers, schedules,
late HTTP/child results, and reload. It requires `CONTINUITY_TEST_MESSAGES=1`, the
usual ship/peer/nest variables, and `SHIP_PIER` for the test ship's pier. It restores
policy, defaults and original native trust; marked test messages and audit records
remain in the disposable conversations.

The adapter watches `/v4` using the native Activity vocabulary. Top-level
messages and replies are normalized once, using the durable source message key.
Channel replies retain their parent activity time; DM replies retain the author's
writ id, **not** its local activity timestamp. Styled input retains text, links,
ship mentions, code, lists and image descriptions. Replies translate Markdown
paragraphs, emphasis, headings, quotes, links, standalone images and fenced code into Story. This is
a small codec, not a complete CommonMark renderer; unsupported syntax remains text.

The first DM is an invitation rather than a post notification, and Chat sends no
notifications for later messages in a DM until the invitation is accepted. After
accepting, the adapter admits up to 64 recent posts newer than both the policy's
activation time and the sender's own admission cutoff, which a change to its
access resets. It preserves original message keys so overlap with live
notifications deduplicates in the head. This bounded invitation catch-up is not
general offline replay.

## ACP configuration and activity

These owner-authenticated extensions work from any initialized ACP client:

| Method | Params | Result |
| --- | --- | --- |
| `harness/tlon` | `{}` | Policy, connection status, queue counts, recent activity |
| `harness/tlon/configure` | Policy below | Acknowledged adapter state |
| `harness/tlon/contacts` | `{}` | `ship`, `nickname`, `contact` directory entries |
| `harness/tlon/profile` | `{}` | Public `nickname` and `avatar` from Contacts |
| `harness/tlon/profile/set` | `{ "nickname": "Bot", "avatar": "https://…" }` | Profile read back after Contacts acknowledges the two-field edit |
| `harness/tlon/watch` | `{}` | State plus subsequent `harness/tlon/activity` notifications |
| `harness/tlon/work` | Optional `before` cursor | At most 16 admission/ledger records, continuation cursor and head availability |
| `harness/tlon/admission/retry` | Admission job `id` | Resume setup/admission against current authority; original source identity is retained |

```json
{
  "enabled": true,
  "owner": "~sampel-palnet",
  "mentions": true,
  "trusted": [{ "ship": "~sampel-sipnup", "tools": [{ "clay": "/harness/lib" }] }]
}
```

Activity notifications contain `sequence`, `kind`, `actor`, `address`, and `event`.
An admitted message's `kind` is `message`, or `bot-message` when its author has
a bot profile. The first bot message read past at the end of a run of bots'
messages is `bot-limit`, and later ones in that run add nothing. A message the
hand ledger refused is `refusal-notice` or `refusal` (see [Retention and capacity](#retention-and-capacity)). The feed retains 128 diagnostic entries. Use session snapshots and the
[hand ledger](hands.md) for conversation history and delivery records.

The head forwards the authenticated `harness/tlon` namespace through
`harness-adapter`'s tiny request envelope; the adapter owns its method vocabulary.
Adapter errors become ACP errors instead of indefinite waits.
Transport authentication has owner authority; do not give untrusted chat
participants the ship login code.

## Delivery and operation

Messages are event-driven. The head emits a native `/hand-events` invalidation
after a ledger or session change, and the adapter reads the durable outbox.
Every subscription starts with an invalidation, so reload/reconnect recovers
pending replies without another incoming message. Receipt events release the
next reply at that destination. There is no message polling timer.

The adapter retains a monotonic native message stamp: multiple replies in one
Gall event must not reuse `now.bowl` as their Messenger ID. This counter survives
reloads and does not delay delivery. When the adapter is stopped, the head can
still save completed replies; unavailable Tlon authority grants no tool effects.

Admission, inference, and publication are separate. The adapter claims a terminal
publication and records its claim attempt before emitting the Messenger poke.
DM receipts record Messenger's **local acceptance**, not remote network delivery
or reading. Channel publications keep Groups' versioned client action and wait
for a host-confirmed post/reply on its native response subscription. The receipt
identifies that channel post, not the local client's optimistic queue entry.
This does not mean that every subscriber has received or read it. Suppressed or
unconfirmed posts remain unresolved; a negative local acknowledgement records
failure, and an unknown outcome never authorizes a resend.
Timeouts or restarts never authorize automatic resending of uncertain sends.
Reconcile them using `harness/hand` health, effect, and resolve operations.

The Tlon Work panel shows admission, execution, and delivery, including setup
failures and retired-binding records. Recovery requires a reason, evidence
confirmation, and the observed attempt number. Stale attempts are rejected
without discarding the draft. Marking Failed does not resend: retry is a separate
action requiring current authority and confirmed non-delivery. Closing the panel
stops polling.

Reload recovery distinguishes an unprocessed claim, an emitted send with unknown
outcome, and a recorded receipt. It can finish a provably undispatched claim or
replay a receipt, but never blindly repeat a Messenger send. Late claim and
receipt responses are fenced by dispatch stage and attempt. Claimed or uncertain
ledger records block their destination even if this adapter has no cached entry.

Tlon maintenance timers are reserved for presence-lease renewal, tool
acknowledgement timeouts, Activity subscription recovery, bounded catch-up and
renewing Steward's gateway lease. Schedule deadlines belong to the head's shared
scheduler. An otherwise idle, connected Tlon hand has no maintenance wake but
that renewal, which comes about every ten minutes while the hand has an owner
and Steward runs. Status exposes `deliveryMode: "events"`, `headConnected`,
`publicationsConnected`, `automationHeld` (see Scheduled Tasks in Tlon
Messenger), and nullable `maintenanceWake` and `leaseRenewal`; `connected`
continues to describe the Activity subscription.

Activity catch-up uses a durable native ingestion-time cursor. Each turn walks
at most 16 selected events plus one lookahead in the current native ordered
tree; it does not serialize or convert the whole feed. Recovery starts on
reconnection, then uses bounded wakes only while behind. It pauses before
advancing past an input when the adapter or head waiting queue lacks room,
counting in-flight admissions as reservations. Current actor/channel cutoffs,
mentions and grants still apply. The normal source-event identity prevents
re-admission across restart; quoted messages and new nonconversational Activity
variants do not acquire command authority.

The cursor recovers events still retained by native Activity, not deleted or
expired native history. Initial activation sets an admission cutoff rather
than answering all historical messages. When the hand ledger refuses a
message's binding or observation, the adapter ends that admission in the same
event, so a conversation the ledger cannot accept does not hold the cursor for
the others. When the head refuses a step of a conversation's route setup, its
waiting messages end the same way and the conversation's route is dropped, so
its next message starts a new setup. A setup waiting on a stopped head resumes
on reconnection instead, and a create the head refuses because the session
already exists restarts the setup while the messages wait. `activityThrough` and `catchingUp` expose the checkpoint and whether
more work remains.

### Upgrading to shared channel conversations

Earlier versions kept one conversation per speaker in each channel. On upgrade,
DM conversations keep their identities and history. Each per-speaker channel
conversation is dropped from the adapter: its binding is disabled and its
session fenced, so queued input there gets no reply, and the session stays in
the head as history. The next message in that channel starts its one shared
conversation, with a new identity.

### Retention and capacity

Conversation identities and their notes outlive route authorization. Revocation
disables the old binding and fences its work; it does not delete its evidence or
assign its old publications to a new binding. Operational limits are admission
backpressure, never permission to prune primary history: 64 pending
admissions; the head separately retains up to 64 schedules across all hands.
These complement the
[shared hand limits and archive protocol](hands.md#fair-admission-and-explicit-retention).

A message the hand ledger refuses, or whose conversation's route setup the head
refused (other than a create refused because the session already exists), is
not retried. The adapter sets `error` to the reason and writes one
activity entry. When the sender still
has grants in that conversation and has not been told in that conversation within
five minutes, it tells the sender "I can't answer messages here right now." and
the entry's kind is `refusal-notice`. Otherwise the kind is `refusal` and
nothing is sent. In a channel the notice mentions the sender, and in a thread it
replies there. The notice is posted outside the ledger, with no receipt or
retry. The five-minute limit is kept only in the 128-entry feed.

The number of conversation identities has no limit, and an identity is never
evicted. Each conversation's route holds a binding in the shared hand ledger,
which has no limit on bindings either; a disabled binding stays there until it
is retired.

To reclaim a settled binding's operational ledger, stop admission by disabling
the adapter, resolve its unfinished work, and export/retire the disabled binding
through that protocol. Re-enabling creates a fresh authorization binding for
future input while preserving the same conversation head and notes. Do not
relabel old events into the new binding. The activity cutoff deliberately starts
a new admission period when the adapter is re-enabled; disabling is not the
same as downtime recovery.

Retiring a ledger binding does not release a social identity or delete a session
log. Primary-history pruning is not implemented. Do not present a ledger
archive as an export of the full
conversation or as proof that external storage is durable.

Only one publication per destination is sent at a time; unrelated conversations
proceed independently.

## Source boundaries

- `sur/harness-tlon`: policy, addresses, adapter state.
- `lib/harness-tlon-policy`: pure actor grants and activity normalization.
- `lib/harness-tlon-story`: pure text/Story conversion.
- `lib/harness-tlon-profile`: pure public-profile projection and edit validation.
- `lib/harness-tlon-io`: versioned Messenger effects and Contacts projection.
- `lib/harness-tlon-presence`: pure context aggregation and leased display effects.
- `app/harness-tlon`: subscription, admission and delivery lifecycle.
- React `TlonSettings`, `TlonModels`, `TlonProfile`, `ShipPicker`, `ToolOptions`: replaceable configuration UI.

`just build` copies the Tlon protocol types and JSON codecs listed in
`desk-deps.yaml` from the repository's `desk/`, under their upstream names. It
takes no applications, marks, desk bill or frontend from that desk.

## Conversation tools and scheduled work

Current-chat tools require a live Tlon binding and an outstanding head request.
They are unavailable to unrelated browser sessions or unbound children.

Kernel browser discovery, browser actions, and Messenger handoffs for secure
input, Vault logins, and payments require a turn from the configured owner's
DM. Harness checks the turn's input against the live Messenger binding and
owner. If that authority ends while a secure form is pending, Harness asks
Kernel to revoke it, including when policy changes while the head is offline.
Harness also revokes known forms when posting fails or a handoff times out,
and cancels known wallet requests through `payment_cancel`. An in-progress fill
or an unconfirmed revocation leaves the outcome uncertain. Pending handoffs
are saved in adapter state, from version 4 on, so a desk reload can continue
checking the outcome or revoke the form. Browser handoffs require a direct Kernel HTTP
endpoint; registration through the ship's MCP proxy is unsupported.
For a trusted ship, adding a browser grant preserves its running conversation
and admission cutoff. Removing the grant still stops its work. Peer access
reports omit browser grants for ships other than the owner.

`tlon_read_history` returns at most 20 messages with durable IDs, authors and
clipped text. Top-level conversations return recent top-level messages. A bound
DM/channel thread returns its parent followed by up to 19 recent replies, omitting
deleted replies and unrelated top-level messages. Native tree traversal and
channel reply requests are bounded; no whole-thread JSON conversion is needed.

`tlon_history_page` walks older messages in the same conversation. Pass an empty
`cursor` for the newest page, then the returned `next_cursor`. Each page inspects
at most 20 entries and returns at most 20 messages in chronological order.
`tlon_search_history` takes a nonblank `query` (at most 128 bytes) and optional
`cursor`. It performs literal ASCII-case-insensitive matching within the first
800 rendered text bytes per message, inspecting at most 64 entries and returning
at most 20 matches per call. This is bounded local history search, not a complete
index. An empty page with `has_more: true` is not an exhaustive no-match.
Where the ship-wide `tlon` tool is granted, these two are left out of the
catalog: its `history` and `search_history` cover this conversation as well,
and its `search_history` without `ship` or `channel` covers every other chat.

Both return `messages`, a separate thread `parent`, `next_cursor`, `has_more`,
`scanned`, `scan_limit`, and `text_limit_bytes`; search also reports the parent's
match through `parent_matches`. Deleted entries advance the cursor without
returning deleted text. Serialized result size can reduce the message count;
the next cursor preserves the first unreturned match. Positions use native local
history keys, not author timestamps, so new arrivals do not shift older pages.
Cursors are scoped to the conversation, actor, authorization generation, tool and
normalized query. Unrelated policy edits leave them valid; affected authorization
changes invalidate them. They never select another destination or confer authority.
The two-ship `tests-js/tlon-history-conformance.mjs` fixture requires
`HISTORY_TEST_MESSAGES=1` and the usual peer/nest variables. It leaves uniquely
marked native test messages, while restoring defaults, policy and native trust.

`tlon_react` and `tlon_unreact` operate on those IDs in that same conversation,
including the parent or individual thread replies. No model argument can select
another destination or expand the recent reaction window. Reading older pages
or search results does not authorize reactions to older messages. Reactions use a
persisted invocation receipt and report local Messenger acknowledgement, not
remote delivery. Missing acknowledgements become uncertain after a minute and
are not automatically retried. Ordinary final replies still use the publication
ledger; there is no arbitrary cross-chat send or group-management grant here.

Tlon uses the [shared scheduler](scheduling.md) for one-time follow-ups, recurring
work, and reminders, for the owner only, in DMs and channel mentions. Results return
to the same DM/channel/thread through normal delivery. To post elsewhere, a run uses
the ship-wide `tlon` tool, which it has when the creating conversation's grants
include `tlon`. An owner DM has it; other conversations take their grants from
**Settings → Defaults** when they are created. Open **Settings → Schedules** to
inspect jobs.

### Scheduled Tasks in Tlon Messenger

Messenger's **Scheduled Tasks** screen lists and edits a bot's tasks through
Steward's automation module, and the hand plays the harness that module
expects. It does so while it has an explicit owner and Steward runs on the ship
with that module; otherwise it neither projects nor takes edits.

Steward gained the module in `%groups` v12.3.0. An older Steward refuses the
hand's watch on `/v1/automation/harness` and serves none of the module's paths,
and a read of one would crash the hand's event, so the hand reads and projects
only once Steward has acknowledged that watch. After a refusal it sends Steward
no projection, reads nothing of the module, and shows `automationHeld: false`;
it watches again only when it loads, its owner changes, or it next takes a
lease Steward does not hold, so a Steward updated in between is found then.
Such a Steward still gets the owner and the gateway lease, which it serves.

The hand watches the head's `/v1/schedule-events` and pokes Steward
`%steward-automation-action-1` `%project` with the complete task set: when
Steward acknowledges the watch on its feed, when a change alters the tasks,
when its schedule watch is acknowledged, and when Steward holds no gateway
lease for it, as a Steward that starts after the hand does not. A run advancing
a job's bookkeeping changes no task and sends nothing. The tasks are the
owner's own schedules on the Tlon hand; other hands' schedules, other actors'
and tool grants never reach Steward. Each maps as:

| Task field | From |
| --- | --- |
| id | the schedule's `@uv` id as text |
| `name`, `description` | the ones a Steward edit gave it; otherwise the prompt's first line, up to 64 characters, and none |
| `enabled` | true for an active job; false for a paused, cancelled or completed one, which stays listed so the owner can delete it |
| `schedule` | `every` with the interval and anchor it was made from, while the job still runs the expression the hand made of them; otherwise `cron` with the expression and the IANA zone it was created with, or else the job's `UTC` or offset; `at` with the instant for a one-time job |
| `payload` | `agentTurn` with the prompt; a literal reminder is a `systemEvent`, OpenClaw's kind for text that runs no agent turn |
| `delivery` | `announce` on `tlon` to the job's conversation: `~ship` for a DM, `kind/~host/name` for a channel |

Agent, session, wake mode and timestamps are left absent.

Before its first projection the hand reads this ship's entry in Steward's
`/v1/automation/tasks`, in the event of Steward's acknowledgement of its watch
and in no other, so never while loading; until then a projection with no task
waits. An absent or empty entry is projected over at once, as on every new bot.
An entry holding tasks the hand did not write, such as ones OpenClaw left, is
not, while the owner has no Tlon schedule of the hand's own: Messenger keeps
showing those tasks until the operator imports them into Harness, and the
hand's status shows `automationHeld: true`. The hold ends with the first
projection that has a task of the hand's own, made in conversation, from the
screen or by the import, and that task set replaces Steward's list. A new
owner's hand holds the same way, since the entry is this ship's whoever owns
it. Once the hand has projected it never reads Steward's tasks again.

While the list is held, Messenger shows the old tasks with nothing saying they
are held. An edit or pause answers `not-found`, since the hand has no such
schedule. A delete also answers `not-found`, which the app treats as deleted,
so the row disappears and comes back on refresh.

The hand also watches Steward's `/v1/automation/harness` and applies each
dispatched edit through the head's cron API, one `%harness-cron` request at a
time, then answers with `%finalize`. Steward replays unanswered commands to a
new subscriber; one already applying is not started again, and a create reaches
the head under an id made from its request id, the low 128 bits, so a replayed
create returns the job it already made. Messenger names a request id, and its
ids fit in 128 bits; for a client that names none Steward mints one from 512
bits, which the hand truncates because the job's run binding, `schedule-` and
its id, must fit the head's 128-byte limit.

- `create` needs a schedule and a prompt. A `cron` schedule's `tz` is `UTC`
  when absent, or an IANA name looked up in the
  [zone table](scheduling.md#tlon-messengers-scheduled-tasks), and the hand
  keeps the name to show it back. An `every` schedule becomes the cron
  expression on `UTC` that runs at the same instants, which exists for an
  interval of whole minutes that divides an hour (15 minutes anchored at :05
  is `5,20,35,50 * * * *`), of whole hours that divides a day (4 hours
  anchored at 02:15 is `15 2,6,10,14,18,22 * * *`), or of a week
  (`M H * * D` on the anchor's weekday). Cron runs on whole minutes, so the
  anchor's seconds are dropped, and the anchor sets only the phase: a job
  anchored later than now still runs at the next matching minute. Without an
  anchor, as in OpenClaw, the interval counts from the creation, or for an
  update from the anchor the task had if its interval is unchanged, and
  otherwise from the update. The hand keeps the interval and anchor to show
  them back. A recurring job has no run limit and runs until it is
  cancelled. It delivers to the owner's DM when its delivery names that DM or
  is absent, and otherwise to the channel it names. The
  job runs as the owner in the bot's conversation there, which in a channel
  is the one shared by everyone there. It answers `created` with the new
  job's id.

  A destination nobody has written in yet has no conversation, and the hand
  opens one before it creates the job, as a first message would: it sets up
  the head session with the conversation's tools and binds it, and the job
  is created in that binding. The owner's DM can always be opened while the
  hand is on. A channel can be opened when the bot's replies there are not
  off and the bot can post in it: it hosts the channel, or it has joined the
  channel and the channel's group, is not banned there, and is an admin there, or the channel
  has no writer roles, or one of its roles is a writer, as the group's
  can-write scry answers. Otherwise the create answers `invalid`
  with the reason: `the bot cannot post in chat/~host/name; add it to the
  channel with permission to write`, `the bot's replies are off in
  chat/~host/name; turn them on in its Tlon settings`, or, with the hand off,
  `the bot is turned off; turn it on in its Tlon settings`, and opens
  nothing. Creates for one conversation that arrive while it is being opened
  share the one opening. If the head refuses to set the conversation up or to
  bind it, the create answers `harness-error`. So does a settings change that
  withdraws the conversation before it is ready, or a change of owner before
  the job is created, and the owner sends the change again. Nothing is posted
  in the conversation until the job's first run.
- `update` patches: `enabled` false cancels the job; a new schedule or prompt
  edits it in place, keeping its run limit if it has one, such as one the bot
  gave it in conversation, and otherwise none; a name or description only
  updates what the hand shows. It answers `updated`.
- `delete` removes the job. It answers `deleted`.

These answer `invalid` with a message: an unknown zone, an `every` interval
under a minute, with a seconds remainder or with no cron expression (such as 45
or 90 minutes, 7 or 36 hours, or 10 days), a create without a schedule or
prompt, a payload kind other than the job's, a target that is not the owner's
DM or a channel the hand can open as above, moving a task to another
conversation, re-enabling a disabled task, and `test`, since the head cannot
run a job once without delivering it. So does any field the hand cannot honor,
named in the message, rather than be dropped. Three are accepted at the one
value that says what a job here does, the values Messenger's own create sends:
`agentId` `main` (OpenClaw's default agent), `sessionTarget` `isolated` (a
fresh session for each run) and `wakeMode` `now` (a run at its time, not at the
next heartbeat); any other value is refused, as are a `staggerMs` other than 0,
`payload.toolsAllow`, `webhook` delivery, `none` delivery (every run posts its
result), `delivery.failureDestination`, `delivery.accountId` and delivery to a
notes channel. Every other field is applied, except `createdAtMs` and
`updatedAtMs`, the host's record of the task, which an edit does not set and
the hand ignores. An id that is not one of the owner's Tlon schedules answers
`not-found`. A head refusal, such as editing a job whose run is still in
flight, answers `harness-error` with the head's message.

Steward admits an edit only from its configured owner, and the hand sets that
owner whenever its own changes, so new edits come from the current owner. A
command Steward admitted before an owner change is still replayed, since the
automation dispatch names no requester; it can only reach schedules the new
owner holds, the new owner's DM and channels the hand can open. A create
still waiting for its conversation when the owner changes is refused.

A job created in the owner's DM before the owner has written there runs
without `%skill-write` and `%author`, as one made in a channel does: a
conversation counts as social until its owner's own message makes it
administrative, and a job keeps the tools it was created with. One created
after an owner message there has them.

Known limits: pausing cancels, and a cancelled job cannot be resumed; an
`every` must have a cron expression; test runs are not supported; a zone's
offset is fixed when the task is created; a job created in the owner's DM
before the owner has written there has the narrower tools above; while the
list is held, Messenger shows the old tasks with nothing saying they are held,
and a delete of one answers `not-found`, so its row disappears and comes back
on refresh.

## Testing

`tests-js/tlon-membership-conformance.mjs` uses two disposable ships to check
owner invitations and channel joining after a later reader-role grant, including
restricted channels and disabled-hand behavior. Supply `SHIP_URL`, `SHIP_COOKIE`,
`PEER_URL` and `PEER_COOKIE`. It makes no model calls, restores Tlon policy and
removes its fixture group. Pure membership tests live in
`desk/tests/harness-tlon-membership.hoon`.

`desk/tests/harness-tlon-automation.hoon` tests the Steward task mapping and
each edit's head actions or refusal;
`desk/tests-integration/harness-tlon-automation.hoon` runs the projection and
edit loop through the hand, with Steward and the head answered by the fixture.
`tests-js/tlon-automation-conformance.mjs` runs it end to end on two ships: the
owner trusts the bot through Steward and creates tasks with Messenger's HTTP
edit into a channel the bot has no conversation in; a one-time task posts
there, and a recurring task there keeps running after the owner's first
message in the channel.

`tests-js/tlon-actions-conformance.mjs` exercises the broad
tool with automatic replies disabled; `tests-js/tlon-denial-conformance.mjs`
checks real two-ship silent rejection, local audit rate limiting and zero model calls
over an accepted DM. It then leaves that DM so the peer's next message is a pending
invitation, and checks that granting the peer access accepts it and answers only
what the peer sends afterward.
`tests-js/tlon-completion-conformance.mjs` checks permissions, moderation, full
message reads, activity, clubs, Notes and granted Clay uploads on disposable test ships, restoring policy and storage settings afterward.
The upload cases need a running `%storage` agent; without one it runs the rest, reports them as not run and exits non-zero.
`tests-js/tlon-hooks-publishing-conformance.mjs` checks real hook compilation,
activation, reactions, schedules, compiler failures, publication without a login,
and removal. It uses unique fake-ship fixtures and removes their persistent hooks,
publications, notebook and group afterward.
`tests-js/tlon-groups-conformance.mjs` checks requester-admin creation, role
semantics, real two-ship invitation/join flows, and denied/authorized remote
administration. Set `SHIP_COOKIE`, `SHIP_URL`, `PEER_COOKIE`, and `PEER_URL` to
local fake test ships. It removes its unique groups and restores Tlon policy.

`desk/tests/harness-tlon.hoon` exercises the pure authority, scope and Story rules.
`tests-js/tlon-conformance.mjs` exercises real DMs, channel mentions, threads,
ACP activity, global session discovery, and revocation between two ships. Supply
`SHIP_COOKIE`, `PEER_COOKIE`, `PEER_URL`, and `TEST_NEST` (an existing peer-owned
test channel, in the form `chat/<peer-ship>/<channel-name>`; `just test` creates one
with `tests-js/lib/test-channel.mjs`). It temporarily grants the
peer ownership, uses the configured inference provider, and restores policy in
`finally`. Set `CONTROLLED_MODEL=1` to use a deterministic local provider and
restore the previous defaults afterward. Use disposable test ships: messages and
auditable sessions are retained.
Neither the test nor the adapter modifies the Groups desk's source code.

`tests-js/tlon-delivery-conformance.mjs` additionally needs `SHIP_PIER` for
real Gall suspension/revival. It checks offline completion, explicit retry,
uncertainty, ordered outbox draining, distinct IDs, whole-desk revival and an idle
hand with no timer. It requires `TEST_NEST`, and `SURFACE=channel` selects
channels. Supplying
`CHANNEL_HOST_PIER` also temporarily suspends the channel host to test a lost
confirmation and recovery from native publication evidence. Every suspended
agent is revived in cleanup; fixture messages and receipts remain.

`tests-js/tlon-presence-conformance.mjs` uses the same two-ship cookie variables
(no channel needed) and a controlled local provider. It checks a real DM's
provider failure, explicit adoption of changed defaults, thinking/tool presence
on the peer, renewal during long inference, cancellation, and resumed delivery.
It restores the test ship's
defaults and social policy. Do not run it concurrently with another test changing
those settings or with a desk compilation.

`tests-js/tlon-profile-conformance.mjs` needs only `SHIP_URL` and `SHIP_COOKIE`.
On a disposable ship it checks direct Contacts edits, acknowledged ACP writes,
validation, clearing, and preservation of unrelated fields and policy. It restores
the touched profile fields in `finally`; test identity changes may already have
been published to peers. The React tests cover external refresh and draft safety.

`tests-js/tlon-tools-conformance.mjs` uses a local provider and the same two-ship
variables plus an existing `TEST_NEST`. It checks unbound-call denial, bounded
history, real DM/channel reaction state, owner scheduling from a DM and a channel
mention with delivery to that conversation, transcript isolation,
recursive-schedule denial, mid-flight source revocation, and that trusted and
allowed ships are not offered scheduling and have forged calls refused. It restores defaults
and policy and cancels fixture schedules; messages and their receipts remain.
`desk/tests/harness-cron.hoon` covers the pure calendar, in UTC and at fixed
offsets, and the strict parser.

`tests-js/tlon-shared-channel-conformance.mjs` runs on three ships: `~zod` is the
bot, the peer (`PEER_URL`, `PEER_COOKIE`) its owner and a guest (`GUEST_URL`,
`GUEST_COOKIE`) a trusted ship, both members of `TEST_NEST`. With a local provider
it checks that the owner and the guest share one channel session while a thread has
its own, that each turn's input names its speaker, that each turn is offered only
its speaker's tools in either order and a guest's forged call is refused, and that
changing or revoking the guest's grants keeps the channel session and its history.
It restores defaults and policy; messages remain.
