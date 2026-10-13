# Saved browser credentials

Status: design proposal for [TLON-6771](https://linear.app/tlon/issue/TLON-6771).
The client controls in [PR #6733](https://github.com/tloncorp/tlon-apps/pull/6733)
and the companion services do not yet implement this complete contract.

## Product contract

The owner's planet stores encrypted passwords and the metadata describing what
they are for. A bot can discover matching saved credentials and request their
use, but cannot retrieve or decrypt passwords. An owner can allow one login or
grant a particular bot permission to use a credential automatically.

The decrypting server needs both a durable server key and a derivative of the
owner planet's login code. Neither the planet's stored data alone nor the
server key alone is sufficient to decrypt the records. The server necessarily
handles plaintext while filling the browser; the destination website also
receives it. The protection separates the bot from these trusted components.

Persistent Chrome profiles remain useful, but saved credentials let the bot
sign in again when browser redeployment or website expiry loses the session.
Cookie persistence is a separate reliability issue, not a replacement for this
feature.

## Storage and permissions

Keep durable credential data and policy together on the owner's planet:

- Credential ID, exact HTTPS origin, account label, and revision.
- Encrypted secret, encryption format, key identifiers, nonce, and integrity tag.
- Permission for each authorized bot: `ask` or `allow`. Absence of an automatic
  grant requires asking; saving a credential alone does not grant reuse.

Discovery returns the ID, origin, label, revision, and effective permission for
the requesting bot. It does not decrypt the password to construct the list.
The trusted server derives the bot identity from its authenticated connection,
not a planet or moon supplied by the model. Discovery is limited to the owner's
bots and the relevant origin; it is not a public credential directory.

Only an authenticated owner operation can save, replace, delete, or change
permission. A bot can request a login but cannot set its own `allow` permission.
Updating or removing a credential invalidates pending uses of its old revision.
Changing permission invalidates pending approvals under the old policy revision.

Metadata participates in authenticated encryption where it binds the encrypted
secret, particularly owner, credential ID, and origin. Permission is checked
against authoritative ship state, not accepted from a copy supplied by the bot.
Keep policy versioning separate from ciphertext so permission changes do not
require decrypting or re-encrypting a password. An owner-requested rebind to a
different site requires an explicit secret update, not a model-supplied URL.

## Encryption and code-derived factor

Use an established KDF and authenticated-encryption implementation. Derive a
credential encryption key from the server secret and a domain-separated factor
of the owner planet's login code, binding the planet, credential, format, and
key epoch. Do not use the public ship name as the second secret, or reuse a
Memex credential as the factor or an approval credential.

The planet-side integration supplies its factor over the authenticated private
service path only when an authorized credential operation needs it. The factor
never appears in MCP results, chat, URLs, model-visible traces, or browser page
state. A service must be able to retrieve it after restart without an online
owner; a factor held only in app memory cannot support unattended login.
Retrieval is an explicit, narrowly scoped service operation, not a general
endpoint for reading the ship's login code. Do not send the raw login code to
the browser service.

Code derivation and authorization are separate. Possession of a factor is not
proof of owner consent. The ship checks owner-authenticated writes, and the
server checks current use permission before obtaining the factor and decrypting.
No additional approval-signing agent is required if the authenticated ship
storage path can provide and atomically enforce the authoritative decision.

Code changes and server-key rotation need a recoverable re-encryption or
key-rewrapping protocol before rollout. Bind records to a key epoch and retain
the ability to read existing encrypted records until the transition succeeds.
Do not assume that a derivative of a replacement code decrypts existing data,
and do not reset the credential store. Select and test the exact derivation,
rotation, and recovery protocol before implementing the cryptographic format.

The server key lives in durable service configuration, outside the bot's
runtime and browser. Hosting provisions configuration and starts processes; it
does not own a second permission database or interpret approval messages. A
separate KMS product and a general permission platform are not prerequisites.
A compromise of the authorized decrypting server remains inside the trust
boundary: it can use factors it is permitted to retrieve.

## Login and A2UI approval

1. The bot discovers that a credential exists for the current site and calls a
   login tool with its credential ID and browser session.
2. The trusted service checks the authenticated bot, live browser origin, record
   revision, and current permission on the ship. It does not infer permission
   from a successful lookup or the presence of only one matching record.
3. With `allow`, it obtains the factor, decrypts, and privately fills the browser.
4. With `ask`, it creates a short-lived login request and returns
   `approval_required` plus a request ID the bot can put in an A2UI prompt.
5. The app fetches the actual request and displays the verified bot, account,
   and site. The owner chooses **Allow once**, **Always allow this bot**, or
   **Deny**. An owner-authenticated call records the decision on the ship.
6. The service rechecks and consumes the applicable approval, then performs the
   fill. The bot receives a status; a conversation message can wake it to resume.

An A2UI button that merely sends "approved" is not authorization. Request IDs
are safe to carry through the bot conversation because possession grants no
permission. The bot cannot substitute its own labels for the app's verified
confirmation or replay a completion message to authorize a new request.

Reuse the browser handoff lifecycle for each login request. Bind approval to
owner, bot, credential/revision, policy revision, exact origin, browser session,
and the prepared login flow; give it a short expiry. A username/password flow
can span multiple forms, but an OTP requires owner input and is not stored as
a reusable password. "Once" covers that bounded login attempt, not an unlimited
session-wide right to fill the password again.

Keep the decision and consumed status in one authoritative place on the ship,
with atomic consumption through the private service path. Do not duplicate
approval ledgers in Hosting, the bot, and the app. Browser processes keep only
the transient state needed for the active handoff. If a process fails after
consumption but before the outcome is known, report an uncertain outcome and
require a fresh one-time approval rather than silently replaying the fill.
A stored `allow` policy survives browser redeployment; an in-flight one-time
request may expire and require asking again.

## Keep the password outside bot access

The decrypt-and-fill operation must be outside the runtime the bot controls.
There is no model-facing decrypt endpoint, secret-return tool, or server key in
the bot environment. The service sends plaintext directly to the browser worker
after authorization. It never routes it through a tool result or conversation.

The bot must also lack a browser-control route that reads the filled password.
Separate owner viewer capabilities from model output, deny raw CDP access to
the bot, and retain HTTP/HTTPS-only model navigation. Audit alternate execution,
network, clipboard, download, recording, screenshot, and inspection paths.

During secret entry, pause model access and return only a sanitized outcome.
DOM-attribute redaction alone is insufficient: page scripts can copy values
into labels, text, URLs, or transformed output. Define and test the conditions
for safely returning browser control. Exact-string filtering does not establish
that arbitrary post-fill page output is safe. The destination website and the
trusted browser worker necessarily see the password; a malicious website that
discloses its own credential is not covered by a claim about secret storage.

The authorized bot receives the authenticated browser session after login.
Permission to use a password is not approval of every subsequent website action.
Revoking saved-login permission stops subsequent credential use; it does not
revoke website cookies. Ending the browser session is a distinct operation.

## Implementation and acceptance

1. Define the ship record, discovery view, and owner-only policy operations.
2. Implement and test the two-input encryption and rotation/recovery protocol.
3. Make login check the ship's policy; add the bounded, atomically consumed
   owner approval and the A2UI confirmation using the existing handoff UI.
4. Close bot-visible decryption, browser-control, and secret-output paths before
   enabling reuse. Report trusted outcomes independently of model-authored text.
5. Validate two planets and two bots, including redeployment between requests.

Required tests cover discovery without secrets, metadata/origin substitution,
bot attempts to change permission, cross-owner and cross-bot access, automatic
reuse only when allowed, one-time approval replay, expiry, stale revisions,
revocation, code/key rotation, and failure during consumption/fill. Test raw-CDP
and alternate output attacks, including re-rendered fields and screenshots.
Verify that browser redeployment preserves records and automatic-use policy,
and that an unavailable ship or factor causes a refusal rather than a fallback.

Preserve stored encrypted records while changing the implementation. Keep the
current `sess_` contract when reconciling the companion MCP branch; readable
session names are an independent API change.

Companion work: [Pioneer #3302](https://github.com/tloncorp/ylem/pull/3302),
[Steel browser #4](https://github.com/tloncorp/steel-browser/pull/4), and
[Steel MCP #4](https://github.com/tloncorp/steel-mcp-server/pull/4).
The [corrected security review](https://github.com/tloncorp/tlon-apps/pull/6733#issuecomment-6019948514)
retracts its claim that moons inherit parent settings write access. Validate the
pinned runtime's actual isolation rather than building on that allegation.
