# Project delegation and client access

Use a project's **Sharing** tab to give conversations document access or issue
read-only keys to scripts and apps. Neither shares private conversations or
grants tools.

## Document roles and task coordination

Project membership controls documents, not tasks. Agents with Workspace access
share task tracking and project metadata. See [task coordination](workspaces.md#coordination)
for assignments, updates, and result links.

Project roles govern shared documents and delegated project editing:

| Operation through Workspace | Reader | Contributor | Maintainer | Owner |
| --- | --- | --- | --- | --- |
| Read project documents, accepted history and proposals | Yes | Yes | Yes | Yes |
| Propose document changes | No | Yes | Yes | Yes |
| Edit project title and description | No | No | Yes | Yes |
| Change membership, archive/restore project, manage client keys | No | No | No | Yes |
| Accept/reject proposals, directly save accepted bodies, publish | No | No | No | Yes |

Each conversation also needs the Workspace tool. Membership uses its stable
identity, so renaming it does not change access. Active delegated children can
use their parent's document access while retaining their own authorship.

Maintainer edits check the project version. Role changes affect subsequent
operations; archiving suspends document membership, not task tracking.
Revocation cannot recall information already copied. Scheduled work can inherit
Workspace; rehearsal runs cannot.

## Read-only project keys

Open a project from **Work → Projects**. In **Sharing → Read-only client access**,
choose **Create read-only key…**, label it, set an expiry, and confirm.
Reveal or copy the key before closing: Harness does not save it in browser
storage or a URL. Creation requires a secure browser random generator.

A key permits reads of its one project's current and future non-archived
documents, accepted body history, proposals, source references, and task records.
It does not expose private artifacts, other projects, membership lists,
conversation transcripts, the owner inbox, unified search, credentials, or audit
history. Metadata may include authors' retained labels and identifiers. Source
URLs are shared project content; they do not grant access to their destinations.

Keys permit reads only. Use this endpoint:

```http
POST /harness-project/read
Authorization: Bearer <project-key>
Content-Type: application/json

{"action":"project","args":{"id":"your-project-id"}}
```

Supported actions: `help`, `projects`, `project`, `artifacts`, `artifact`,
`revisions`, `revision`, `proposals`, `proposal`, `tasks`, and `task`. `help`
describes this restricted interface. Lists accept `offset` and `limit` (1–4).
Bodies are limited to 8,000 UTF-8 bytes per page; follow `nextOffset` with the
fixed revision number. Owner list limits and model Workspace read conventions
are described in [workspaces](workspaces.md#interfaces-and-bounds).

The route accepts only POST at this exact path, without a query string.
JSON bodies are limited to 8,192 bytes. Authentication requires the key,
not an owner cookie.
Missing, expired, revoked or suspended credentials receive 401; forbidden
actions receive 403; unavailable records/invalid read parameters receive 404.
Malformed JSON/args receive 400, oversized bodies 413, other methods 405.
Document reads refresh native Notes content and return 503 if Notes is
unavailable; they do not substitute cached bodies. Metadata lists read Harness
records without fetching Notes bodies. Reads issue no mutation cards and change
no Harness durable state.

## Expiry, recovery and storage

Keys use 32 cryptographically random bytes, formatted as `hpr_` plus 64 lowercase
hex digits. The durable credential registry retains a SHA-256 digest, project,
label, creation/expiry times and optional revocation time—not a retrievable key.
Protect the ship's event logs and backups: inbound credential creation and read
events may contain the original secret even though the registry stores a digest.

The UI offers 1, 7 or 30 days; the owner API accepts 1–30 days. Expiry is fixed
at creation and checked on every request. Archiving suspends a key; restoring
the project reactivates it only if still unexpired and unrevoked. Revocation is
permanent for that credential identity. A repeated revoke preserves its original
revocation time. Previously accepted reads and copies cannot be undone.

If creation loses its confirmation, **Retry same key** repeats the original
identity and secret. An identical active request can recover the result without
extending expiry, even if the project version has since changed. It cannot
change scope, replace the secret, or revive an expired/revoked key. If the dialog
is closed before confirmation, inspect the credential list and revoke any key
whose local copy was lost. No automatic write retry is performed.

The owner ACP interface uses `harness/workspace` actions `clients`,
`client-create`, and `client-revoke`. Creation requires
`{id, project, version, label, key, days}`; revocation requires `{id, project}`.
Creation fences the current project version. Labels are limited to 128 UTF-8
bytes. There are at most 256 retained credentials across the ship, including
expired and revoked tombstones; revocation does not reclaim capacity. Metadata
lists are paginated, with no secret or digest returned. There is no
credential deletion, rotation-in-place, or automatic expiry-maintenance loop.

## Equivalent effects and deployment boundary

These restrictions describe authority added by Workspace roles and project
keys. They are not a sandbox over independently granted ship-wide authority.

| Independent interface | Relationship to project authority |
| --- | --- |
| Workspace model tool | Shares task tracking under the tool grant; checks document roles and record versions where required. Owner actions remain denied. |
| Model administration tool | Cannot call owner Workspace methods to issue keys, change membership, accept or publish. |
| Native owner Workspace poke and authenticated owner ACP | Intentionally retain owner powers; never distribute the ship login to project clients. |
| Native Notes / Tlon tools | Independently granted native access can edit or publish outside the Workspace proposal workflow. Membership neither adds nor revokes that access. |
| General HTTP, code execution, other independently granted resources | Not restricted by project roles. They may have equivalent effects if separately given credentials/authority. Review these grants before delegating to external participants. |
| Webhooks and other ship endpoints | Not protected by a project key. Each has independent deployment/authentication requirements. |

Use HTTPS remotely and configure the public proxy to expose only
`/harness-project/read` for a project client. The separate `/harness-project`
binding does not require exposing `/harness-api` or owner ACP. Harness accepts
secure Eyre requests or loopback connections; a TLS-terminating proxy on loopback
must itself enforce HTTPS and its intended public route. No CORS permission is
added. Responses use `Cache-Control: no-store`, `Referrer-Policy: no-referrer`
and `X-Content-Type-Options: nosniff`. Configure proxy logs not to record bearer
headers; rate limiting and perimeter configuration remain operator duties.

Notes reads select only the requested project's note identities; publication
status is read separately. No owner conversation or notebook-wide body listing
enters this route. Configure proxy, DNS, and TLS separately.

## Verification

Pure native tests: `/tests/harness-workspace-maintainer`,
`/tests/harness-project-client`, `/tests/harness-boundaries`. Full-agent isolated
tests: `/tests-integration/harness-project-client`. These inspect cards and
state without executing the emitted effects.

Run the installed loopback endpoint check with:

```sh
SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/local-cookie \
SOAK_EXPECT_SHIP='~your-local-ship' node tests-js/project-client-conformance.mjs
```

The check verifies local ship identity before writes. It creates two uniquely
named projects, one task and one one-day key; it finally revokes that key, closes
the synthetic task, and archives only those projects. Test-owned records and credential tombstones stay
as evidence. It creates no Notes documents, calls no models, publishes nothing,
and performs no external sends. Native Notes body-source isolation is checked
by the isolated fixture, not this metadata-only live smoke test.
