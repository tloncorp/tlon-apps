# Browser card commands

The `hosted-browser` skill owns browser workflow: collecting checkout details,
choosing secure entry or live sharing, successive login steps, recovery, and
resuming the task. Read it from the available-skills listing before planning
those flows. This reference covers only the Tlon command contract. If the
browser skill is unavailable, report the missing installation resource rather
than inventing a workflow or collecting secrets in chat.

## Invocation and delivery

Call the model-facing `tlon` tool with an argument string. Do not include the
`tlon` executable name or invoke a shell. Both commands accept the `session_id`
(`sess_` handle) returned by `browser_session_create` for the live session.

The plugin resolves a fresh signed viewer URL through the authenticated
browser service and passes it privately to its delivery transport. Do not
fetch, copy, construct, edit, or supply a viewer URL in a model tool call, or
send one as a raw or labeled link in ordinary chat.

These commands are exceptions to sending ordinary messages through `message`.
They deliver only to the configured owner of the active bot account, with no
recipient argument or override. Missing owner configuration fails instead of
sending to someone else. Claim delivery only after the command succeeds.

## Share a live browser

```json
{"command":"browser share <session_id>"}
```

Sends a rich link card in Tlon Messenger that opens the live session for viewing
and interaction. It does not request credentials or generate a task
continuation.

## Request secure entry

```json
{"command":"browser handoff <session_id>"}
```

Sends a native Tlon secure-entry card for the session. Supported fields are
login identifiers, passwords, verification codes, and payment-card details.
Each fill is bound to the exact live controls and origin; values go directly
to the browser service without passing through chat or the bot. Completing
entry generates a task continuation. Sending the card or filling fields does
not submit a purchase or grant purchase approval.

`browser_session_handoff` is a separate MCP viewer/elicitation operation, not
a prerequisite for either Tlon command or a way to refresh signed viewer URLs.
Its `client_capability_missing` error does not establish whether the Tlon card
is available.

## Errors and discovery

Invalid handles, failed session lookup, missing owner configuration, and
failed delivery are errors; do not claim a card was sent or fall back to a raw
viewer URL. Consult `hosted-browser` for recovery and session-lifetime behavior.
An unavailable secure form is a client discovery state after card delivery,
not proof that the delivery command failed.

Use the `tlon` tool's `help browser` command for installed syntax if this
reference and the available command disagree.
