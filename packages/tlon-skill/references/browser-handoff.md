# Browser card commands

The `hosted-browser` skill owns browser workflow: collecting checkout details,
choosing secure entry or live sharing, successive login steps, recovery, and
resuming the task. Read it from the available-skills listing before planning
those flows. This reference covers only the Tlon command contract. If the
browser skill is unavailable, report the missing installation resource rather
than inventing a workflow or collecting secrets in chat.

## Invocation and delivery

Call the model-facing `tlon` tool with an argument string. Do not include the
`tlon` executable name or invoke a shell. These commands accept the `session_id` returned by
`browser_session_create` for the live session.

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
{"command":"browser handoff <session_id> --fields '[\"@e12\",\"@e13\"]'"}
```

Sends a native Tlon secure-entry card for the selected controls. Take a current
browser snapshot and use its `@eN` references. The JSON array also accepts
exact HTML names (`{"name":"ssn_3"}`) or accessible labels
(`{"label":"Birth month"}`) when they identify one visible snapshot control.
Do not supply CSS selectors or field values. Select the whole logical input,
including each month/day/year control for a date; one radio reference selects
its choice group.

For an exact name or label containing an apostrophe, encode each apostrophe as
`\u0027` inside the single-quoted JSON array. When writing the enclosing tool
JSON, escape that backslash as `\\u0027`:

```json
{"command":"browser handoff <session_id> --fields '[{\"label\":\"Mother\\u0027s maiden name\"}]'"}
```

This selects the exact label `Mother's maiden name`. Prefer snapshot references
when available; do not place a literal apostrophe inside a single-quoted array.

Text inputs, textareas, dropdowns, checkboxes, and radio groups are supported.
Each fill is bound to the selected live controls and origin; values go directly
to the browser service without passing through chat or the bot. The browser service reports each step’s result to the originating
agent conversation. Wait for that result before using the browser again. Each card
fills one step without submitting. The agent inspects the page and chooses the next action.
Sending the card or filling fields does not grant purchase approval.

A replaced control can resolve by its recorded name or label only inside its
original form and document. An ambiguous name, changed document, expired card,
or changed control requires a fresh snapshot and a new handoff. Do not remove
`--fields` to recover from a selection failure: that broadens the request.

Both `browser handoff` and `browser approve-login` require `--fields`. Saved
login approval uses the same selection; an optional `--record` selects the saved
account. After the service reports a result, inspect the page and request a
fresh card if another private field needs input. Click Continue or Sign in
through browser tools when appropriate. Dismiss optional passkey enrollment
unless the owner asked to create a passkey.

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

Selection rejections require a fresh snapshot. A service timeout or temporary
outage calls for a short pause before trying again; a configuration or access
failure must be reported to the owner and checked before retrying. Preparation
gets one attempt of up to 30 seconds and is not automatically retried.

Use the `tlon` tool's `help browser` command for installed syntax if this
reference and the available command disagree.
