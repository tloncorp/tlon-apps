# Hosting boundary, version 1

This contract describes how a hosting service connects to Harness; the hosting
control plane is not included. The host operates the ship. Harness keeps
conversations and owner settings.

## One authority per field

| Field | Authority | Acknowledgement and observation |
| --- | --- | --- |
| Ship identity | Ship identity system | Read the actual ship, never a display name |
| Installed release | Clay plus the assembled release artifact | Host records artifact digest, dependency pins and state versions; installation is acknowledged only after agents load |
| Desired release and rollout phase | Hosting control plane | Separate requested, installed, healthy and rolled-back states |
| Provider/default configuration | Harness durable state | Use the authenticated configure/read APIs; a submitted request is not acknowledgement |
| Conversation overrides, grants and scoped notes | Harness and its Tlon policy adapter | Preserve across upgrades; changing hosting defaults does not rewrite them |
| Provider credentials | Harness credential state | Provision through explicit credential operations; status exposes presence/validity, never secret values |
| Tlon storage credentials and selection | Native Tlon storage | Harness consumes that selection; no duplicate host or Harness storage form |
| Subscription, invoices and spending entitlement | Billing service | Keep billing facts out of conversation memory; supply an explicit service policy, not forged tool receipts |
| Conversations, accepted work and publication evidence | Harness head and hand ledger | Read durable identities and receipts; never infer completion from HTTP success |
| Infrastructure health and resource limits | Host | Report observations with timestamps and release identity |

A version-1 host record identifies `contractVersion`, `ship`, `desiredRelease`,
`installedRelease`, `rolloutPhase`, and timestamped health observations. Release
identity includes the complete artifact digest, not only a Git revision: the
assembly includes pinned dependencies and generated assets. Credentials are
references/presence flags in that record, not plaintext. Unknown contract
versions require explicit negotiation; they must not be silently normalized.

Write configuration through its owning service and read back the result.
After a timeout, inspect state before retrying. Host defaults are suggestions;
replacing owner settings requires an explicit operation.

`hosted-provision` accepts a complete `providerKeys` snapshot and optional
`primary` and `fallbacks` model defaults. `primary` is a `{provider, model}`
object; `fallbacks` is an ordered list of those objects. The primary selects
an API-key provider endpoint. OpenRouter defaults enable zero-data-retention
routing for the primary and fallback chain. Model defaults apply only before
defaults are initialized. Successful owner model changes through `hosted-settings` also
mark defaults initialized, so provisioning and restarts preserve that choice.
Credential snapshots continue to update platform-owned slots independently.

## Soul and shared skills

Authenticated Spider requests use `POST /spider/harness/json/hosted-soul/json.json`
and `POST /spider/harness/json/hosted-skills/json.json` with the ship's existing
Eyre session cookie and a JSON object body. Both return the hosted envelope
`{"status":200,"body":...}`; inspect its status as well as the HTTP status.
The hosted capabilities response advertises `soul: true` and `skills: true`.
These are owner-authorized configuration operations, not public content APIs.

`hosted-soul` exposes the default system instructions as a text body, not a
separate filesystem copy. Send `{}` to read `{body, revision}`; send
`{body, revision}` to replace it using the revision just read. Empty text is
allowed. The result includes the saved text and revision. This changes the
instructions inherited by new conversations, not existing conversation
configurations, provider settings, or tool grants.

`hosted-skills` operates on the same shared skills as the Harness skill editor:

| Request body | Result body |
| --- | --- |
| `{}` | Catalog of `{name, desc}` entries, without instruction bodies |
| `{"name":"example"}` | `{name, desc, body, revision}`, or status 404 |
| `{"name":"example","desc":"Purpose","body":"Instructions","revision":""}` | Creates an absent skill and returns its full saved record |
| `{name, desc, body, revision}` | Replaces that skill using its current revision and returns its full saved record |

Writes require a revision. A stale revision returns status 409 without changing
content; read again before retrying. An empty revision creates a skill only if
that name is absent. Updates replace one shared skill, never the catalog or
conversation-local skill experiments. Shared changes are available to later
skill reads; existing tool grants remain unchanged. These endpoints do not
delete skills.

Soul text is limited to 65,536 UTF-8 bytes. Skill names are 1–128 bytes,
descriptions up to 1,024 bytes, and instruction bodies 1–65,536 bytes. Requests
allow up to 409,600 encoded JSON bytes to accommodate escaping. Unknown fields
and invalid content fields return status 400; non-object or oversized transport
requests fail before dispatch.

The focused live check uses `tests-js/hosted-content-conformance.mjs` with
`SHIP_URL=http://127.0.0.1:<port>`, `SHIP_COOKIE=/path/to/private-cookie`, and
`HOSTED_CONTENT_TEST_SHIP=<ship-name-without-tilde>`. Run it on a local test ship:
it temporarily edits the soul and creates a uniquely named skill, verifies
read-back and revision conflicts through both HTTP and native ACP, then restores
the soul and deletes only its test skill. It makes no provider calls.

## Health and failure

Report head availability, Tlon Activity/head/publication subscriptions,
admission backlog, uncertain publications, resource pressure and optional
executor availability separately. A single green HTTP check is insufficient.
`delivered` means the concrete adapter's documented receipt, not that a human
read a message. A provider or executor outage must not erase accepted work or
make unrelated native commands unavailable. Billing suspension must have an
explicit admission policy; it must not invent successful or failed external
delivery evidence.

Harness does not enforce private-network isolation. Iris does not validate DNS
answers against pinned public-IP connections; hostname checks are insufficient.
Hosts that require egress restrictions must supply them.

## Release acceptance

A pilot must cover fresh installation, migration of saved defaults and scoped
grants, accepted work across restart, missing optional executors, provider
outage, using disposable fake ships or newly provisioned moons. Do not copy or
restore piers. Code rollback is not state rollback: once a migration changes
persisted nouns, only a compatible release may load them. Harness deployment
changes only the Harness desk; native integrations use existing interfaces.

## Operational measurements

Measure admission acknowledgement and stop acknowledgement separately from
provider latency and destination delivery. For empty, active and long-lived
conversations, collect replay time, idle events,
allocated/live loom, durable state growth and incremental per-conversation
cost. Record release identity, workload size and host resource allocation with
the measurements. Medians alone hide interruption and long-history tails;
include distributions and failure cases.
