# Hosted-browser sharing and secure form handoff

The hosted browser may read public Tlon pages (exposed content, published notes,
profiles, invite links). Do not use it to open or operate the Tlon app itself;
Tlon operations go through the `tlon` and `message` tools only.

## Share a hosted browser session

When the owner wants to see or interact with a browser session, call the `tlon`
tool with:

```json
{"command":"browser share <session_id>"}
```

Pass the `sess_` handle returned by `browser_session_create`. This sends a rich
link card in Tlon Messenger that opens the live session in the browser. It does
not request credentials or send a task continuation. Use `browser handoff`
below when sensitive input is needed.

Never send a browser-session URL as a raw or labeled Markdown link in ordinary
chat messages. Do not fetch, copy, construct, or expose the signed viewer URL;
the plugin resolves it privately. If sharing fails, explain the failure and
retry when appropriate; do not fall back to sending a URL.

Both browser commands are exceptions to routing ordinary messages through
`message`. They send only to the configured owner; never claim delivery until
the command succeeds.

## Secure form handoff

Use a secure form handoff when you are controlling a hosted browser on behalf
of your owner and the live page needs sensitive input that they should provide,
including identifier-only, password, and verification steps, as well as address
and payment-card fields. Each handoff fills the fields visible on one page and
returns control to the bot. Login forms can submit; other forms fill without submitting.

Do not ask the owner to send credentials, card details, or private addresses in chat. Do not type, store,
repeat, summarize, or otherwise bring those values into model context. Ordinary
navigation and non-sensitive form filling should continue through the browser
tools without a handoff.

First navigate the live session all the way to the visible form. If the page
contains multiple forms, focus a field in the intended form with the browser
tools before sending the handoff. Use the `session_id` (`sess_` handle) returned
by `browser_session_create` for that same session. In OpenClaw, call the model-facing `tlon` tool with:

```json
{"command": "browser handoff <session_id>"}
```

Do not include the executable name in the tool's `command` argument. Use this
tool, not a shell command. The plugin resolves a fresh signed viewer link through
the authenticated browser service and passes it directly to the CLI for card
delivery. Never copy, construct, edit, or supply a viewer URL yourself.

Do not call `browser_session_handoff` as a prerequisite for this card. That tool
uses MCP viewer/elicitation capabilities to arrange human browser control; it
does not issue or refresh signed viewer URLs. Its `client_capability_missing`
error does not determine whether the Tlon secure form is available.

The `browser handoff` operation is an exception to routing ordinary messages through `message`. It always sends the handoff card to the owner configured for the active bot
account. It has no recipient argument or override. If no owner is configured,
it fails instead of sending the form elsewhere. Never claim the handoff was
sent unless the command returned success.

The card opens a native Tlon secure form. It does not embed the remote page.
The browser service describes the visible fields using standard autofill
purposes, including identifiers, passwords, verification codes, addresses, and
card details. Each fill is bound to the exact live controls and origin. Values
travel directly to the browser service, without passing through chat or the
bot. Do not read or repeat filled sensitive fields through browser tools.

Keep the session live while the owner completes the form. Each handoff shows
its destination and requires fresh input. Filling fields does not authorize a
purchase, payment, or other consequential action.

When entry finishes, the app resumes the conversation automatically. Wait for
that continuation message, then inspect the same browser session, check the
current page and validation state, and continue the task. For each new page or
step that needs owner input, send a fresh `browser handoff <session_id>` using
the same session handle and wait for its continuation. This includes separate
identifier, password, verification-code, and signup-details steps. Each signed
handoff link covers one successful form fill. If the site still shows the submitted form,
inspect its validation state before requesting another handoff. Entry does not
prove sign-in or transaction completion. Do not ask the owner to press both
controls; the card's “Continue task” button is a manual alternative. Release the session
promptly when the browser task is finished.

Ambiguous forms, custom controls, passkeys, CAPTCHA, and unsupported steps can
be completed through “Open live browser” on the same screen. Do not guess field
selectors or ask for the values in chat. If a card expires while its session is
still live, send a fresh card using the same session handle. If the lookup
fails, report the failure; do not invent or edit a URL or claim a card was sent.
If the live session expires, create a new one and navigate to the required form
before sending its handoff.

#### What persists

Do not describe the live session itself as permanent. A live Chrome session,
its tabs, its current page, and its signed handoff URL are temporary and end on
release, inactivity timeout, hard timeout, or Pod restart. Signed viewer URLs
are temporary bearer capabilities handled by the plugin and browser service.
Use only the session handle in the Tlon tool; never quote a signed link into
chat or share it with another user.

The browser *profile* is persistent. In the self-hosted deployment, the MCP
credential identifies the owner and transparently selects that owner's durable
browser profile. Cookies and browser storage saved when a session closes are
reused by later sessions for the same owner, so a successful login normally
survives without leaving Chrome or hundreds of idle tabs running. A new session
may open on a fresh page, but it should retain the saved login state. Logging
out or clearing site data can persist that logged-out state as well.

Profiles and session handles are isolated by MCP credential. A caller cannot
open another owner's profile or session merely by guessing or obtaining a
session handle; each browser call is authorized as the current credential.
Treat a signed handoff URL as sensitive anyway because it intentionally grants
temporary access to that one live session.

When the owner asks how this works, explain it plainly: they enter the secret in
a native Tlon form; Tlon submits it directly to their live browser; the bot does
not receive the value; and the resulting browser login is saved in their
isolated profile for later browser tasks. Do not claim that Tlon or the bot has
stored their raw password.

> **Deprecated: diary channels.** `%diary` is not managed by the CLI: `tlon notebook`, `--kind diary`, and `diary/...` targets fail with guidance toward `%notes`. Use the `tlon notes` family for Markdown notebooks. An owner can preview a legacy diary with `tlon notes migrate-plan <diary-nest>` and migrate it with `tlon notes migrate-apply <diary-nest> --yes`.
