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

Run `just setup PIER ~owner` to set the owner and enable the hand. Trusted ships
and their tools are set through `harness/tlon/configure`.

**Bot profile** edits the ship's Contacts nickname and avatar. It refreshes
external changes without overwriting drafts, and waits for Contacts to confirm
saves. Empty fields clear those attributes; other fields, permissions, and
conversations stay unchanged.

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
   `just setup PIER ~owner`, which also enables owner sync.
2. On the owner ship, trust the bot: `:steward &steward-action-1 [%trust-bot ~bot]`.
   Replace `~bot` with the bot's ship name. Sponsorship alone does not grant trust.
3. Owner sync also sets the bot's local Steward owner, so owner-requested run
   retries reach Harness. While online, the hand holds Steward's gateway lease, so
   Steward doesn't tell that owner the bot is offline. The lease lapses within 15
   minutes of the hand stopping.
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
Trusted ships need an explicit grant; current-chat tools do not imply it.

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
  `edit_message` preserves channel post/reply identity and metadata. Native Tlon
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
Open the Harness conversation for details. For a `401`, check that conversation's
endpoint and credential. Refreshing the page does not retry inference.

Send `/help` for the shared [conversation commands](acp.md#conversation-commands).
Mention rules still apply. `/stop` interrupts work and clears queued inputs;
other commands wait for the turn to finish.

`/work` manages tasks and documents in chat. Protected owner operations require
an owner DM; other actors use their Workspace and document permissions.
See [work commands](work-control.md).

### Shared memory

Relevant durable facts are recalled automatically across channels and local
subagents. Use `/remember preference Keep replies short.` to save a fact,
`/memory [query]` to inspect memories, and `/forget preference` to forget one.
Use `/memory off` for a conversation that should neither recall nor capture
shared facts. Model replies containing commands do not execute them.

In mention-only channels, select the bot's native mention first, then type the
plain slash command in the same paragraph—for example, **@Bot /memory**. The
addressing prefix is removed before the shared command interpreter runs; it does
not bypass sender or mention authorization. Plain-text ship spellings, other
ships' mentions, formatted command text and multi-paragraph messages do not use
this shortcut. DMs and replies to the bot's own channel posts do not need it.

Memories retain their source actor and are shared across conversations. They
survive compaction and reloads. Forgetting leaves historical copies. See
[shared memory](context-and-memory.md#shared-memory).

### One companion, scoped conversations

The ship is the companion's identity. Contacts supplies its name and avatar;
each conversation keeps its own instructions and model.

Preferences retain their source actor. Shared recall uses that attribution
when selecting personal communication preferences.
Skills are an owner-managed shared instruction library, not personal memory.
Social conversations and their descendants cannot write, stage or publish into
that library, regardless of saved tool grants. An operator can deliberately install
reusable instructions outside a social conversation.

For a channel thread, ordinary message admission captures the native parent
and up to eight recent replies as attributed public reference material. The
snapshot records destination, message IDs, ships, timestamps and clipped text
separately from the current input. It never reads another actor's Harness log or
notes, and it grants no execution authority. Its encoded message budget is 6 KB;
each message has the history reader's 800-byte text limit. Snapshots may omit
older replies. Commands do not retrieve or interpret this material. DMs and
top-level channel conversations receive no automatic cross-message context.

## Thinking and tool activity

The public “Bot · Offline” badge reads the `bot-liveness` Contacts field.
The native hand publishes `{"v":1,"state":"online"}` when it is enabled,
its Activity subscription is acknowledged, and its head subscription is live;
otherwise it publishes `offline`. Adapter events reconcile only that field,
preserving the rest of the profile and skipping unchanged claims. Reload and
reconnection repair the claim. A failed Contacts read or edit retries on the
next adapter event without blocking chat or creating a nack loop. If the whole
ship stops, peers retain the last published claim until the ship returns.

Chat computing indicators use `%presence-action-1` and the
`tlon.computing-status.v1` display payload, matching the versioned Groups
Presence protocol.
The adapter publishes “Thinking...” or named tool activity (for example,
“Searching the web” or “Reading chat history”) in the DM/channel context.
Only unfinished calls in the latest tool batch contribute. Names are restricted
to the native catalog; unknown calls get a generic label. No prompts, arguments,
MCP server/tool identifiers, results, or reasoning content are included.

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
`TEST_PANE` for adapter suspension/reload checks. It downloads a real public
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
  **Known bug:** these saved tools don't limit owner turns with administrative
  authority, which get the live catalog. See [known bugs](../ISSUES.md#known-bugs).
- Trusted ships can chat with no tools; each grant is explicit.
  MCP entries grant individual registered server IDs, for example
  `{"mcp":"calendar"}` in the `tools` array. Registering another server never
  adds it to trusted actors' grants. A granted server permits all of its tools.
- Other ships and the bot's own messages do not enter inference.
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
- Sender and exact destination/thread determine the stable conversation. A shared
  channel does not share the owner's private DM transcript or execution grants.
  Channel answers are still public to that channel's members: granting file,
  web, skills, peer, or MCP access can expose whatever those tools can read.

Permission changes retire only affected authorization routes. Adding an unrelated
trusted actor leaves existing conversations, in-flight work, notes, saved model
settings and schedules alone. Changing the mention requirement affects channels,
not DMs; changing an actor's role or effective grants affects that actor's work.
Grant order alone is not a revocation. Disabling Tlon affects every route.

Affected queued/running work is cancelled, old bindings are disabled, native
timers and delegated work are fenced, and source schedules are paused until
explicitly rescheduled. The head retains its transcript, shared knowledge and chosen
configuration. New authorized input resumes that same head only after cancellation
and a tools-only configuration update have been acknowledged, using a fresh
binding. Old publications cannot move to the new binding. Actor-specific admission
cutoffs reject queued pre-grant messages without dropping unrelated input.

Publication checks the exact current binding and actor again after claiming,
before sending. Async callbacks and self-dispatched work carry request generations,
so reusing a tool-call ID cannot revive an old request. Previously emitted network
operations cannot be undone; their receipts and uncertainty remain evidence.
Saving unchanged policy leaves routes and sessions alone. Conversation heads
remain distinct from authorization bindings and scheduled-run sessions.

`tests-js/tlon-continuity-conformance.mjs` exercises native DM/channel threads,
unrelated and affected permission edits, notes, chosen settings, timers, schedules,
late HTTP/child results, and reload. It requires `CONTINUITY_TEST_MESSAGES=1`, the
usual ship/peer/nest variables, and `TEST_PANE` for the test ship's Dojo. It restores
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
The feed retains 128 diagnostic entries. Use session snapshots and the
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
acknowledgement timeouts, Activity subscription recovery and bounded catch-up.
Schedule deadlines belong to the head's shared scheduler. An otherwise idle,
connected Tlon hand has no maintenance wake. Status exposes `deliveryMode: "events"`,
`headConnected`, `publicationsConnected`, and nullable `maintenanceWake`;
`connected` continues to describe the Activity subscription.

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
than answering all historical messages. Retained jobs remain recoverable.
`activityThrough` and `catchingUp` expose the checkpoint and whether more
work remains.

### Retention and capacity

Conversation identities and their notes outlive route authorization. Revocation
disables the old binding and fences its work; it does not delete its evidence or
assign its old publications to a new binding. Operational limits are admission
backpressure, never permission to prune primary history: 128 retained social
identities and 64 pending admissions; the head separately retains up to 64
schedules across all hands. These complement the
[shared hand limits and archive protocol](hands.md#fair-admission-and-explicit-retention).

To reclaim a settled binding's operational ledger, stop admission by disabling
the adapter, resolve its unfinished work, and export/retire the disabled binding
through that protocol. Re-enabling creates a fresh authorization binding for
future input while preserving the same conversation head and notes. Do not
relabel old events into the new binding. The activity cutoff deliberately starts
a new admission period when the adapter is re-enabled; disabling is not the
same as downtime recovery.

Retiring a ledger binding does not release a social identity or delete a session
log. At identity capacity, existing conversations remain usable and new ones
are rejected visibly. Automatic identity eviction and primary-history pruning
are not implemented. Do not present a ledger archive as an export of the full
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
work, and reminders. Results return to the same DM/channel/thread through normal
delivery. Open **Settings → Schedules** to inspect jobs.

## Testing

`tests-js/tlon-membership-conformance.mjs` uses two disposable ships to check
owner invitations and channel joining after a later reader-role grant, including
restricted channels and disabled-hand behavior. Supply `SHIP_URL`, `SHIP_COOKIE`,
`PEER_URL` and `PEER_COOKIE`. It makes no model calls, restores Tlon policy and
removes its fixture group. Pure membership tests live in
`desk/tests/harness-tlon-membership.hoon`.

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

`tests-js/tlon-delivery-conformance.mjs` additionally needs `SHIP_DOJO_PANE` for
real Gall suspension/revival. It checks offline completion, explicit retry,
uncertainty, ordered outbox draining, distinct IDs, whole-desk revival and an idle
hand with no timer. `SURFACE=channel` plus `TEST_NEST` selects channels. Supplying
`CHANNEL_HOST_DOJO_PANE` also temporarily suspends the channel host to test a lost
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
history, real DM/channel reaction state, cron delivery, transcript isolation,
recursive-schedule denial and mid-flight source revocation. It restores defaults
and policy and cancels fixture schedules; messages and their receipts remain.
`desk/tests/harness-cron.hoon` covers the pure UTC calendar and strict parser.
