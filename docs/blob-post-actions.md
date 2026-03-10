# Action Button Blob Entry

The `action-button` blob entry type attaches interactive buttons to posts.
Each button carries a label and an action that fires when the recipient taps it.

The primary use case is LLM-generated messages with structured actions —
e.g. "Approve" / "Deny" buttons that poke the appropriate agent or send a
canned response without the recipient typing anything.

## Entry shape (`action-button` v1)

| field     | type                              | notes                                         |
| --------- | --------------------------------- | --------------------------------------------- |
| `type`    | `'action-button'`                 | discriminant                                  |
| `version` | `1`                               | schema version                                |
| `label`   | `string`                          | button text shown to user                     |
| `action`  | `ActionButtonAction` (see below)  | what happens when pressed                     |
| `target`  | `string` (optional)               | ship, role, or `'all'` — controls visibility  |

### `action` discriminated union

Each button does exactly one thing when pressed, determined by `action.type`:

**Poke action** — fires an arbitrary Urbit poke:

| field  | type      | notes                            |
| ------ | --------- | -------------------------------- |
| `type` | `'poke'`  | discriminant                     |
| `app`  | `string`  | Urbit app to poke                |
| `mark` | `string`  | poke mark                        |
| `json` | `unknown` | the poke payload (JSON-safe)     |

**Response action** — sends a chat message back to the channel:

| field    | type                | notes                                              |
| -------- | ------------------- | -------------------------------------------------- |
| `type`   | `'response'`        | discriminant                                       |
| `text`   | `string`            | message text to send                               |
| `hidden` | `boolean` (optional)| hide from sender's view (default `true`)           |

## Entry shape (`action-response` v1)

When a response-type action button is pressed, the resulting message carries
an `action-response` blob entry so the UI can identify it:

| field          | type      | notes                                        |
| -------------- | --------- | -------------------------------------------- |
| `type`         | `'action-response'` | discriminant                         |
| `version`      | `1`                 | schema version                       |
| `sourcePostId` | `string`            | ID of the post with the button       |
| `actionLabel`  | `string`            | label of the button that was pressed |
| `senderHidden` | `boolean`           | suppress in sender's message list    |

## Template variables

Poke-type actions support template variables that are resolved at press time:

| variable            | resolves to                          |
| ------------------- | ------------------------------------ |
| `{{currentUser}}`   | the pressing user's ship name        |
| `{{targetUser}}`    | the post author's ship name          |
| `{{currentChannel}}`| the channel the post appears in      |
| `{{targetChannel}}` | a referenced channel (e.g. linked)   |

Variables are replaced recursively through the entire `json` payload.
Unresolved variables are left as-is.

## Security considerations

The poke action executes with the recipient's identity. A malicious sender
could embed a poke that does something the recipient didn't intend.

Current mitigations:
- The button label is visible before pressing — the user decides to tap
- Response-type actions are inherently safe (just send a message)

Future mitigations under consideration:
- Confirmation modal showing the target app/mark before firing a poke
- Allowlist of safe app+mark combinations
- Restricting poke targets to the post sender's ship

## Button visibility

The optional `target` field controls who sees the button:
- A ship name (e.g. `~zod`) — only that ship sees the button
- A role name — only members with that role see the button
- `'all'` — everyone sees the button
- Omitted — everyone sees the button (same as `'all'`)

Target-based filtering is not yet enforced in the UI.

## Graceful degradation

Older clients that don't recognize `action-button` will render the standard
"Upgrade your app" blockquote. No crash, no data loss.

## Key files

| file | role |
| ---- | ---- |
| `packages/api/src/lib/content-helpers.ts` | Schema definitions, append helpers, parse logic |
| `packages/api/src/lib/postContent.ts` | Block types, `convertContent` mapping, plaintext preview |
| `packages/app/ui/components/PostContent/ActionButtonBlock.tsx` | Button UI component |
| `packages/app/ui/components/PostContent/actionButtonPoke.ts` | Poke execution + template resolution |
| `packages/app/ui/components/PostContent/actionButtonUtils.ts` | Grouping consecutive buttons into rows |
| `packages/app/ui/components/PostContent/BlockRenderer.tsx` | Block renderer registry |
| `packages/app/ui/components/PostContent/ContentRenderer.tsx` | Template context threading |
