# Conversation work management

Use `/work` to inspect and manage work in chat without opening the web app.
Start with `/work help`, or ask for `/work help projects`, `/work help tasks`,
or `/work help review`. Replies show names and outcomes; **Details** shows
the underlying arguments and records.

Owner Tlon DMs also show navigation buttons. Other clients show text commands.
Both use the same permissions and command handling; see [Tlon controls](#optional-tlon-controls).

Create records without JSON:

```text
/work project-new Weekend plans
/work task-new Draft a packing list
```

Everything after `task-new` is the title. To choose a project, use `task-create`
with its optional `project` field. Creation and task updates run immediately.

`/work projects` and `/work tasks` list active work, including standalone and
completed tasks but excluding archived projects and their tasks. Add `all`
to include archived records. `/work project PROJECT_ID` and `/work task TASK_ID`
open details.

JSON filters support `includeArchived`, `project` (tasks), `offset`, and `limit`.
Filtering precedes pagination; next-page commands retain filters. Tool/API reads
return JSON and include archived records unless `includeArchived: false`.

Reads, project creation, and task bookkeeping run immediately with current
agent or human authority. Task tracking and project metadata do not require
document membership. Other management changes prepare an exact payload
and offer an action-specific confirmation, Cancel, and optional Details:

```
/work result <id>
/work confirm <id>
/work reject <id>
/work details <id>
```

`result` shows the exact pending preview or the durable execution receipt.
`confirm` submits the prepared change once; `reject` settles a pending request
without executing it. Neither rejection nor cancellation undoes a submitted
external operation. Confirmations expire after fifteen minutes. Changed work
requires a new preview and confirmation.

Navigation accepts short references or canonical IDs; ambiguous references are
rejected. Approval tokens retain the full content digest and bind the request,
action, and arguments. Permissions and same-person/conversation checks still
apply. Details reads the canonical JSON record.

For example:

```
/work tasks {"project":"meeting","limit":4}
/work task-create {"id":"agenda","project":"meeting","title":"Draft the agenda"}
/work task-create {"title":"Check tomorrow's forecast"}
/work task-assign {"id":"agenda","version":1,"assignee":"researcher"}
```

Use the version returned by a read for updates and assignments.
`task-update {id,version,title?,description?,project?,status?,outcome?,artifact?}`
changes supplied fields; `project: null` ungroups a task.
`task-delete {id,version}` removes only the record.
See [coordination](workspaces.md#coordination) for assignment and permission rules.

## Conversation execution and reviewed replies

Agents answer in the current conversation using their tools and delegation.
Tasks track progress; they do not launch agents or arrange later delivery.

For a separately selected accepted document, owner conversations can prepare
an exact reviewed send through `/work` or the `manage` path:

```
/work task-reply {"id":"agenda","version":3,"artifact":"agenda-result","revision":1,"binding":"my-hand-binding","actor":"alice"}
```

`task-reply` requires a done task with a linked artifact and an exact accepted
revision. Its preview shows the complete body and destination. Confirmation queues
that literal body, limited to 1–4096 bytes, through the existing hand ledger. It
does not invoke a model, interpret slash commands, or publish a public Notes page.
The receipt's `done` status means submission completed; its separate `delivery`
field reports pending, claimed, delivered, failed, uncertain, or abandoned.

Open `/work task TASK_ID` to read the recorded outcome or linked result. More actions
contains **Review drafts**, **Read saved document**, and **Mark complete**.
`/work finish TASK_REF` records completion against the current task version
without a confirmation step. Draft reading is paged;
acceptance opens a separate complete preview before confirmation. Acceptance
saves a revision but does not mark the task done. Marking done records task
completion but does not approve a draft or send anything.

For a done task with a saved result, **Send here** sends
`/work task-send TASK_ID`. The head prepares `task-reply` using the current task
version, linked artifact's accepted head revision, and the current owner hand's
binding and actor. It does not infer a destination from task text. The preview
must still be inspected and confirmed; the shortcut never sends immediately.
Use explicit `task-reply` arguments to prepare another authorized destination.

The head rechecks the approving conversation's authority, its incarnation, the
destination, and accepted content when a transport claims or retries delivery.
The approval binds the selected task, document, document project, and destination,
not unrelated workspace writes. Changes to those dependencies while a reply waits
in the queue require reconciliation and a new approval. Reconcile
the existing effect first: pending, claimed, uncertain, and delivered replies block
another reply for the same task, revision, binding, and actor. An explicitly failed
or abandoned effect permits a new approval; an approved replacement fences retries
of the earlier failed effect. An uncertain effect never retries
automatically. Authorized hand diagnostics retain receipts for reconciliation after
delivery authority changes; `/work result` still requires its original conversation
and current management authority. Reading a receipt does not send anything.

## Natural-language requests

Agents call Workspace read and task-tracking actions directly. For protected
human-requested changes, `action: "manage"` takes an `args` object containing
`{action, args}` and uses the human's current permissions.

The human opens the returned `inspect` command to see the head's exact preview
before confirming. Model prose, tool results, and printed slash commands cannot
supply that confirmation. Administration cannot manufacture human input, hand
observations, or delivery receipts.

Normal agent Workspace operations share task tracking and project metadata
under their tool grant. Document operations retain their scoped membership and
proposal semantics. Project edits through an agent's own authority require the
maintainer role and cannot archive a project. Project editing and archival
through human management retain exact preparation because they also affect
shared documents. Delegated and scheduled work cannot use human management.

## Optional Tlon controls

Owner DM replies can include native A2UI buttons alongside the complete ordinary
message. A head-generated pending protected preview offers an operation-specific
confirmation, **Cancel**, and **Details**. A natural-language preparation offers
**Review** first; model prose cannot enable confirmation. Settled requests offer
an appropriate next action, such as **View task** or **Check delivery**,
and Details. Changed or expired inspected requests
offer Tasks and Projects recovery navigation. Buttons send the same literal `/work` commands
into the conversation, subject to all current server-side checks.

Navigation requires a matching head result and current owner authority. If the
read changes before delivery, the card offers refresh instead of stale actions.

Cards open with an `h2` title and human context. A task card shows the title,
status, description, and outcome, then **Refresh task** or **Read result** and
**More actions**; a task without a project has no **Open project**. Task lists
offer **Add task**.

Cards use `tlon.a2ui.basic.v1`'s `Text`, `Column`, `Row`, `Divider`, `Choice`, and
`Button`, with `tlon.sendMessage`. These components are available in
`tlon-apps/develop`. `desk/lib/harness-tlon-work-card.hoon`, `harness-work-copy.hoon`,
and `harness-work-view.hoon` supply content and actions; Tlon's theme supplies all
styling, with no custom styles, renderer extensions, or images. Names, longer
actions, and **Refresh task** use wrapping Choice rows; short actions share button
rows, after a divider when choices precede them. Button labels do not wrap, so
**Saved copy** labels the Read saved document action.
`storyMode: "fallback"` shows the card's message once on supporting clients.
Uninspected preparations leave model text visible and offer Review only.
Channels and other hands receive text. Missing cards do not block delivery.
Cards are snapshots; inspect again for current status.

The web renderer's `Button.Frame` lacks a button role and keyboard tab stop.
Text commands provide the complete keyboard-accessible path.

## Authority and persistence

Local human ingress uses local owner authority. Tlon uses its live owner DM
policy; a public channel or a trusted non-owner does not acquire owner access.
An enabled generic hand can receive an explicit owner management grant:

```
/work hand-access {"binding":"my-hand-binding","actor":"alice","owner":true}
```

The grant itself requires owner preparation and confirmation. Use `owner:false`
to revoke it. A non-owner hand requires its current Workspace tool grant for task
tracking and project metadata. Document operations also require their current
document permissions. Membership shares documents, never private transcripts;
task assignments grant neither document access nor execution tools.

Confirmation binds the exact session incarnation, source, binding, address, and
actor. Permissions and document content are checked again at execution. Stored
results also require current authority; knowing an ID grants nothing. Each approval
binds its operation's records: project changes bind the selected project; document
changes bind the selected document, proposal where applicable, and document project;
replies also bind the selected task and destination. Hand-access grants bind the
destination and existing grant. Unrelated work does not invalidate an approval.
Native Notes content is checked independently.

Requests and results survive reload. Notes writes use the existing asynchronous
Notes request ledger; a submission acknowledgement is not a successful result.
Inspect `/work result <id>` for completion. At most 2,048 approvals can be active:
unexpired pending requests and all running requests count toward admission.
Completed, failed, rejected, and expired pending requests do not consume active
capacity. Receipt history remains retained for inspection and delivery deduplication;
the active limit does not bound historical storage or silently delete receipts.
Arguments are limited to 32 KiB; reads and exact preparation previews are limited
to 48,000 encoded bytes. Preparation also bounds the readable receipt to 48,000
bytes. Reads use at most four list items and paged document bodies.
Review and publication previews show complete selected content; an oversized
preview is rejected rather than silently truncated. Confirmation requires a
head-generated preview whose complete text matches the current preview within
the latest 64 conversation events; inspect again
if intervening conversation moves it outside that window.

## Verification

`desk/tests/harness-work-control.hoon` checks origin, expiry, changed content,
one-shot settlement, exact-preview provenance, and current result visibility.
The focused full-head test is
`desk/tests-integration/harness-work-control.hoon`.

`desk/tests/harness-tlon-work-card.hoon` covers optional card selection and states;
`desk/tests-integration/harness-tlon-work-card.hoon` exercises the head projection
with synthetic live Tlon authority. `desk/tests/harness-tlon.hoon` verifies that
native DMs retain the optional payload while channel sends omit it.
`+harness!harness-work-card-fixtures` produces synthetic ready, inspect, settled,
and expired renderer fixtures directly from the shipping Hoon projection. They
can be validated against the merged Tlon schema and rendered by its existing
`ChatMessage` fixture without delivering messages.
`+harness!harness-work-navigation-fixtures` supplies project/task browsing,
task outcomes, draft review, and saved-document examples from the same shipping
read and card functions.

Run the loopback-only live fixture with:

```sh
SHIP_COOKIE=/path/to/test-ship-cookie SOAK_EXPECT_SHIP='~test-ship' \
  node tests-js/work-control-conformance.mjs
```

It checks human-only confirmation, cross-actor denial, revocation, stale content,
task creation, real Notes review, literal reviewed replies, delivery receipts,
uncertain-effect reconciliation, and a synthetic model that prints a confirmation
command without executing it. The full-head task-note test checks direct creation
and completion with no claim, artifact, approval, membership grant, or new agent. The live
fixture disables its hand and archives its project and
artifact while retaining audit records. It sends no social messages and uses no
paid inference.
