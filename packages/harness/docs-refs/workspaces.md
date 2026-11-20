# Tasks, projects, and artifacts

Tasks keep track of work. Projects group related tasks. Artifacts are documents
you can edit, share, and publish.

Ask your agent for what you need. It can keep track of larger jobs and coordinate
with other agents without asking you to manage tasks. Simple questions need no
task at all.

## Use it

Open **Work** in the sidebar when you want to look in. The top-right navigation
has four views:

- **Inbox** shows work that needs attention, including blocked tasks and proposals.
- **Tasks** lets you inspect, create, and update tasks, with or without a project.
- **Artifacts** lets you write documents, review agent proposals, and publish.
- **Projects** groups tasks and documents. A project's **Sharing** tab controls
  [document access](project-access.md) for conversations and read-only clients.

You can also manage work in chat; `/work help` lists the commands.
See [conversation work management](work-control.md) for details.
Agents need the **Workspace** tool, which is included in default tool settings.

To work on a document, create an artifact or ask an agent to draft one. Your edits
save directly; agent proposals wait for your review in **Proposals**. **History**
shows saved revisions. **Publish…** lets you preview a saved revision and make it
public. Saving alone does not publish anything. Documents require Groups' native
Notes app.

Unsaved drafts stay in this browser tab when session storage is available; save
them to keep a revision on the ship. If someone else saves first, your save is
rejected and your draft stays intact. Copying a revision to another project
creates a separate artifact without sharing the original's private history;
sharing its source references requires confirmation.

## Ownership

Notes stores document bodies, revision history, titles, and published HTML.
Harness stores their Notes identities, projects, proposals, source references,
and tasks. Direct Notes edits appear in Harness.

Workspace-enabled agents share task tracking and project metadata. Documents
have separate access: agents can read their own artifacts and project documents
shared with them. Contributors can propose changes; active delegated children
can use their parent's document access. Membership uses stable conversation
identities and never shares transcripts or grants tools. See [project access](project-access.md).

Native Notes permissions are independent. New artifacts use a private Harness
notebook; sharing that notebook in Notes can expose its other documents.

## Revisions, review and publication

Human body edits save in Notes using an expected current revision. Harness shows
native revision zero as saved revision one. A body-identical save does not create
a native revision. **Rename…** separately updates the unversioned Notes title;
it neither saves the local body draft nor republishes the document. Source
references are Harness metadata, not native body history.
Agent edits create proposals containing the exact replacement, source references,
author and base revision. Accepting a proposal checks that base and live access;
stale proposals cannot overwrite newer work. Existing-note proposals must retain
the current title; title changes use the explicit owner rename action. Rejection
preserves the proposal.
Shared documents are reference material, not agent instructions.

Publication through Workspace is a separate owner action selecting and previewing a saved snapshot.
Notes gives it a fixed public address:
`https://your-ship-domain/notes/pub/~host/notebook/note-id`.
Readers do not sign in. Your reverse proxy must forward this path to the ship;
Harness does not configure DNS, TLS, or the proxy.
Independently granted native Notes/Tlon permissions can permit equivalent edits
or publication outside Workspace; project roles do not restrict those grants.
The preview token binds the exact title, body, and HTML. Notes serves only that
published title and body; later edits leave the snapshot unchanged. Private
history, proposals, project records, and source metadata are excluded.
Unpublishing removes the Notes HTML snapshot; Notes may return its app shell at
the address instead of a 404. It cannot erase copies held by other people.
Rendered HTML is inert, with escaped raw HTML and a restrictive meta CSP.
Notes owns the HTTP response headers; Harness supplies the rendered document.

Native writes wait for the Notes result, not just transport acknowledgement.
An uncertain result blocks further document mutations. Use **Check result again**
to reattach to that result without repeating the write. If the result cannot be
recovered, inspect Notes before explicitly releasing the wait. Releasing does not
cancel or undo a native write; the unsaved browser draft remains available.

## Unified search

**Search content** combines conversation evidence, accepted Notes body history,
project titles/descriptions and task titles/descriptions/outcomes. One artifact
appears once even when many versions match; expand its matching revisions and
read a specific historical body without replacing the current editor. All query
terms must occur in the same revision. Unsaved drafts and pending proposals are
not indexed. Archived records are labeled.

The incremental index reports backfill status. Notes availability is checked
before returning its content; an unavailable backend produces explicit partial
results, not a stale private body. Query/index/workspace changes invalidate old
result tokens and require refreshing. These owner search methods do not expand
the model's workspace permissions or conversation-only corpus recall.

## Coordination

The task is the unit of work. A project is an optional collection: `task-create`
accepts a title, description, and optional project. Ungrouped tasks persist with
an empty project string and appear as `project: null` in JSON.

Agents use tasks for larger jobs and coordination. Their instructions call for
concrete deliverables and completion checks, delegation of independent pieces,
and verification of results. Routine bookkeeping stays out of replies; useful
results, blockers, and decisions come back to the user.

For [cross-ship work](peers.md#coordinating-work-across-ships), keep one task on
a home ship. Mutually Workspace-trusted peers update it through peer tools;
`ask_peer` dispatches the work.

Workspace-enabled agents can create projects and manage tasks without document
membership. Updates, claims, assignments, and deletion require the current
version. Recreated IDs have higher versions than their deleted records; unrelated
writes leave versions unchanged. Recording an outcome needs no claim or artifact.

Adding or replacing a result-document link requires read access. Keeping or
clearing one does not. The link itself grants no document access.

`task-assign {id,version,assignee}` records an existing agent's session name, or
clears the assignment when `assignee` is null. The head resolves its identity and
checks its current Workspace tool grant. Assignment records an actor without
changing task status, granting tools, creating a session, or dispatching work.
`task-claim {id,version}` atomically claims open work; assignment does not create
an exclusive permission to edit the task. Reopening a task clears its assignment.

`task-update` edits title, description, project, status, outcome, and linked
artifact in one version-checked write. Omitted fields stay unchanged; a null
project ungroups the task. Metadata-only edits preserve assignment.
`task-delete {id,version}` permanently removes the tracking record without
stopping an agent or deleting its documents. Agents retain useful outcomes;
deletion is not automatic cleanup of completed work.

Artifacts and projects support editing and archive/restore; archiving preserves
their history. The task list hides tasks in archived projects; standalone tasks
remain visible.

Tasks do not start or cancel inference, wake idle agents, or prove external
actions. Work runs in a conversation or through delegation; later updates need
an active worker or [schedule](scheduling.md).

[Work commands](work-control.md) handle task tracking directly. Document access,
review, publication, project editing/archival, and [selected document delivery](social-workflow.md)
retain their own approval rules. Maintainers can edit project metadata only.

## Interfaces and bounds

The [inbox](inbox.md) combines work metadata and links to source records.

Owner ACP calls use `harness/workspace` with `{action, args}`. Native local-owner
pokes use mark `harness-workspace` with `{id, action, args}` and replies on
`/workspace/<id>`; subscribe before poking. `/workspace-events` emits a revision
invalidation, not private document contents. Owner `/x/workspace` scry retains
the typed workspace state. Models use `workspace` with `{action, args}`, where
`args` is a JSON object. The `help` action lists supported operations.
Models cannot use approval, publication or membership actions, including through
the administration tool. Scheduled work can inherit Workspace for task
bookkeeping; rehearsal runs do not receive it.

Work directories are most-recently-updated first, with stable identity ordering
for equal timestamps. Filtering and ordering precede pagination. Artifact and
project recency is saved independently of the bounded audit history. Metadata
lists use the watched Notes projection without fetching document bodies; opening
document content refreshes Notes and fails closed if it is unavailable.

Read lists are paginated. Models receive at most four entries and 8,000 UTF-8
body bytes per page; follow `nextOffset` using `revision` with the returned
revision number. Source references have separate paging. Owner lists default to
24 entries, with a maximum of 64. The UI mounts one shared invalidation watch
and refreshes visible queries on change, focus, or a 30-second fallback.

Harness mutation limits are explicit rejections: 512 artifacts, 128 projects, 2,048 proposals,
2,048 tasks, 64 members per project, 256 accepted revisions per artifact, 256
title bytes, 256 KiB body bytes, 16 source references and 64 MiB conservatively
accounted retained content. Archiving hides records; it does not delete them or
reclaim capacity. Accepted revisions and proposals remain retained; the audit
stream retains the most recent 2,048 changes. Native Notes remains authoritative;
external Notes edits are subject to its own limits. Assignment remains recorded
until agents update it; it does not expire when execution stops. Removing document
access cannot recall copies.

Public Markdown supports headings, paragraphs, lists, quotes, code fences,
simple tables and limited inline formatting. Raw HTML is escaped, remote images
are not embedded, and scripts/forms/external resources are blocked by document
policy. Links in the document body are public; separate source references stay private.
Inspect the publication preview rather than assuming full editor/GFM parity.

## Local verification

Run `just build` and `node --test tests-js/*.test.mjs` at the repository root. Native
tests include `/tests/harness-workspace`, `/tests/harness-notes`,
`/tests/harness-workspace-search`, `/tests/harness-unified-search` and
`/tests/harness-boundaries`, `/tests/harness-workspace-maintainer` and
`/tests/harness-project-client`.

`SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/local-cookie node tests-js/workspace-conformance.mjs`
checks real local Gall, ACP, deterministic model tools and anonymous public HTTP.
It refuses remote hosts, creates uniquely named local fixtures and archives its
documents/projects after unpublishing any pages. Fixture conversations and
historical records remain for inspection. It makes no paid provider requests
and changes no global configuration.

`SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/local-cookie node tests-js/notes-workspace-conformance.mjs`
checks direct native edits, history, separate rename, stale preview rejection,
native publishing/unpublishing, preserved project metadata and request isolation.
It retains one archived private test note and its project, and withdraws its
temporary public snapshot. Neither script modifies the Tlon desk.
