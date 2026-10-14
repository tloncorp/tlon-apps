# Saved browser credentials

The owner's planet stores encrypted passwords, exact HTTPS origins, account
labels, optional usernames, and per-bot reuse permission. A bot can discover matching credentials
and use those marked `allow`. Credentials marked `ask` require owner authorization.
Saving defaults to `ask`; conversation messages never grant access.

The secure handoff supports manual entry, saving a login, selecting a saved
login, and choosing whether the bot can sign in automatically. Saving is opt-in
and defaults to asking before reuse. Saved-password management screens are a
separate UI integration backed by service endpoints and typed client helpers.

## Storage and encryption

Pioneer stores records in the parent planet's `%settings` bucket
`%moltbot/%browser-logins`, partitioned by bot moon and credential ID. Each record
contains its origin, label, optional username, revision, timestamps, permission, encryption factor,
key ID, nonce, authentication tag, and ciphertext. Sibling bots do not share
credentials. Updates, permission changes, and deletion check the expected
revision under the planet's writer lock and wait for the ship to acknowledge
the result. Hosting has no credential or permission database.

The encrypted payload contains the username and password. The username is also
available as readable account metadata; the password remains encrypted. The server uses AES-256-GCM and
HKDF-SHA256, combining a durable 32-byte server key with a domain-separated
SHA-256 derivative of the owner planet's login code. The HKDF context binds the
format, planet, moon, and credential ID. Authenticated metadata binds the origin,
label, username when present, factor, key ID, creation time, and identity. Revision and permission are
checked against current ship state, so policy changes do not require decryption.

Each record retains the factor used to encrypt it. Changing the planet's code
therefore does not invalidate saved passwords. Owner proofs use domain-separated
HMAC-SHA256 with a ten-minute expiry, checked against the current code and server
time. The server allows one minute of clock skew. The encryption factor grants
no owner authority. Raw codes stay in the app and Pioneer. Factors, owner proofs,
and decrypted secrets never appear in model-facing account lists or login results.

The server key is durable deployment configuration shared by the browser
clusters in an environment. Back it up. Replacing it requires an explicit
re-encryption migration; losing it makes records unreadable. Existing ciphertext
is preserved on migration failure. Owner access migrates stored formats with
revision checks and defaults automatic reuse to `ask`.

## Login and owner approval

`browser_login` with `action: "list"` returns matching account IDs, labels, usernames,
origins, revisions, timestamps, and permissions without decrypting passwords.
The app rejects owner requests to a different Hosting environment.
The service verifies the moon's derived browser key through Pioneer; ship
headers are only routing hints until verification succeeds.

A login request checks the current page, exact HTTPS origin, credential revision,
and stored permission. With `allow`, the service decrypts and fills the private
browser API. With `ask`, it returns `approval_required`. Owner-authorized use
requires a client to obtain a grant and submit the selected credential revision.

The handoff authorization endpoint returns account metadata and a one-use grant.
The fill endpoint accepts a credential selection, optional save parameters, and
explicit automatic-use permission. The one-use grant binds the live session and prepared form,
expires after five minutes, and is consumed before filling. A replayed chat
message, form submission, or completion callback cannot authorize another fill.

Only reusable username/password login forms qualify. A login can span username
and password steps on the same origin. OTPs require owner input. New-password,
card, and cross-origin forms do not become saved credentials. Saving and filling
have separate outcomes; a filled form is not proof of successful sign-in.

Durable `allow` permission survives browser redeployment. In-flight approvals and
redaction context are transient; unrecovered browser handles require a new
session. A process failure never recreates a consumed one-time approval.

Owner-authenticated endpoints list metadata, change automatic-sign-in permission,
and delete credentials. Deleting a credential or revoking permission does not clear website
cookies or terminate an already authenticated browser.

## Browser access boundary

The decrypt-and-fill service runs outside the bot's runtime. The bot receives
neither a server key nor a plaintext-return endpoint. Raw public CDP is disabled.
Opening the live viewer requires a separate owner-authenticated capability;
the conversation's viewer link alone cannot stream or control the browser.

For credential-enabled MCP sessions, screenshot, PDF, raw live-view, recording
replay, and diagnostic artifact tools are refused. Filled values and common
encodings are redacted from text results and automation-model input, including
values copied into page text, accessible names, and URLs. Model navigation
accepts only HTTP and HTTPS. Browser logging also protects submitted values and
stops recording further DOM/image events after private entry.

The trusted browser and destination website necessarily receive the password.
Exact-value redaction does not protect against a malicious destination that
arbitrarily transforms and discloses its own credential. Keep the browser's
control APIs private and isolate browser egress from internal control services.
The design does not claim secrecy against a compromised decrypting service or
a hostile destination site.

## Solaris account management

The authenticated account owner can list all saved-credential metadata on a ship:

```http
GET /v1/ships/:ship/browser-logins
```

The response is `{ "accounts": [...] }`. Each entry has `id`, `moon`, `origin`,
`label`, `revision`, `updatedAt`, and `permission`, plus `username` when saved. Both Pioneer and Solaris use
explicit field projections; ciphertext, factors, keys, nonces, and passwords
are excluded.

Delete the selected revision with:

```http
DELETE /v1/ships/:ship/browser-logins/:moon/:credential?revision=3
```

Deletion returns HTTP 204 after ship acknowledgement. An outdated revision
cannot delete a replacement credential. The endpoint uses Solaris's existing
ship-owner authorization and the existing `PIONEER_SIDECAR_TOKEN` for its private
Pioneer request. Steel uses the same existing sidecar token for the vault API;
no additional service token is required. Metadata management does not ask for
the planet code or decrypt a password. A stale deletion revision returns HTTP 409.

## Validation and rollout

Tests cover owner/bot separation, discovery without decryption, exact-origin
binding, consent defaults, automatic reuse, revocation, one-time grants, expiry,
revision conflicts, migration preservation, and separate encryption/owner hash
domains. Gateway tests reject bot viewer streams and raw CDP. A real-Chrome test
copies a filled password into page text and accessible names, verifies MCP
redaction, and refuses inspection after its protection context is lost.

The services remain disabled until operators provision the durable key and
private-service configuration. Deploy Pioneer, then matching browser/MCP/viewer
images and a client with saved-login controls before enabling the feature. Validate with synthetic
accounts on multiple bot moons and test browser redeployment before production.

Tracked in [TLON-6771](https://linear.app/tlon/issue/TLON-6771), with changes in
[Tlon #6733](https://github.com/tloncorp/tlon-apps/pull/6733),
[Pioneer/Solaris #3302](https://github.com/tloncorp/ylem/pull/3302),
[Steel browser #4](https://github.com/tloncorp/steel-browser/pull/4), and
[Steel MCP #4](https://github.com/tloncorp/steel-mcp-server/pull/4).
