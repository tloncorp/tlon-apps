# A2UI approval cards: what bots send

Status: the app and schema part is implemented (stacked on tloncorp/tlon-apps#6970, which restyles bot cards without changing what bots send). The two bot changes are not done yet. The fields are documented in `post-blobs.md` under "Rendering hints".

## Why

The approval and pending-request designs on the "Tlon A2UI rendering" canvas (page "Before / after: every card") show things today's payload can't express:

- a kicker: an icon and the card's kind ("DM access", "Channel access", "Group invite", "Pending requests"), with a status on the right ("2 waiting", "Allowed");
- the requester as a person (avatar, nickname, handle) in a bordered inner card, with their message lined up under the name; channel and group details on a footer line inside that card; for invites, the group and who invited the bot;
- Block as a full button with a red label;
- an answered state: the buttons give way to a result line ("You allowed Sam Palnet to DM the bot.") and the kicker shows the status ("Allowed").

Both bots already send most of the words. `packages/openclaw/src/monitor/approval.ts` and `packages/hermes-tlon-adapter/approval.py` build the same tree: a caption "eyebrow", an h3 title, a divider, caption lines (`Sender: …`, `Channel: …`, `Message: "…"`), a note, and Allow (primary), Reject and Block (borderless). What's missing is structure and a few hints about how to draw it.

## Rules for changing the format

1. **Only optional fields on existing components.** No new component types, no new values on existing enums (a `destructive` button `variant` would be one), no blob `version` bump. Older apps parse cards with `blobEntrySchema` in `packages/api/src/client/a2ui.ts`. Anything it rejects turns the whole post into "Upgrade your app to see this post". Unknown keys on a component are stripped silently, so new optional fields are safe.
2. **New fields parse leniently on new apps.** Each one uses `.catch(undefined)` (zod 3.25 has it), so a value a future bot sends that this app doesn't know drops that one field, never the card. Without this, today's new fields become tomorrow's breaking change.
3. **The tree stays the content.** Hints change how new apps draw a component; they never carry words that old apps would miss. Every hinted component keeps a readable `text`.
4. **Stay inside the limits** (50 components, depth 8, 12 children per container, 8,000 characters). New text fields count toward the character budget (`indexComponents` in `a2ui.ts`).

## The fields

| Field | On | Values | New apps | Old apps |
| --- | --- | --- | --- | --- |
| `role` | `Text` | `'kicker'`, `'status'` | Kicker: small medium grey label at the top of the card, with an optional icon. Status: right-aligned in the kicker row. | Caption text, as today. |
| `icon` | `Text` with `role: 'kicker'` | allowlist of `@tloncorp/ui` icon names: `AddPerson`, `Channel`, `ChannelMultiDM`, `Mail`, `ChannelNotebooks`, `Clock`, `Lock`, `Link` | Drawn before the kicker label. Unknown names draw no icon. | Ignored. |
| `entity` | `Text` | `{ type: 'ship', id, name? }` or `{ type: 'group', id, name? }` | A person row (avatar, nickname, handle) or a group row (group icon, title, flag), drawn from the app's own contacts and `useGroupPreview`. `name` is the bot's display name, used when the app has no nickname or the group isn't joined. | The `text`, e.g. `Sam Palnet (~sampel-palnet)`. |
| `tone` | `Button` | `'destructive'` | Red label (`$negativeActionText`) on the button's usual surface. | Ignored. |
| `resultLabel` | `Button` | string, up to 1,000 chars | Once this button is used (the same consumption the renderer already tracks), the button row is replaced by this line. | Ignored; used buttons fade, as today. |
| `statusLabel` | `Button` | string, up to 64 chars | Once this button is used, shown as the card's status in the kicker row. | Ignored. |

`resultLabel` sits next to the existing `consumedLabel`, which relabels the one button that was used (the credit request card uses it). The result line takes the tone of the used button: positive for the primary one, neutral for others, destructive for a `tone: 'destructive'` button.

Two things need no new fields:

- **The inner card is a nested `Card`.** The new renderer already draws one as a bordered inner card. Old apps draw it as their own nested card (white, bordered), which reads fine.
- **The one-line post text** ("DM request from Sam Palnet (~sampel-palnet)") is hidden under a rendered card when the blob sets `storyMode: 'fallback'`, which the app already supports. Neither bot sets it for approvals today.

Renderer rules, all inside a `Column`:

- Plain `Text` that follows an `entity` row (directly, or after other plain text) lines up under the name rather than under the avatar.
- A caption right after an `entity` row joins that row's handle line ("~nocsyx-lassul wants to DM the bot"). Old apps show it as its own line.
- The last child of an inner card, when it is a `Row` that isn't a row of buttons, is a footer line under a hairline that runs across the card.
- An inner card that holds its own buttons, like one pending request, draws its person row with a smaller avatar.
- A borderless `Button` that is not in a row of buttons draws as a small text link, which is how "View message" sits on the footer line.

## Card shapes

DM access (channel and group follow the same pattern):

```
Card root
  Column body
    Text  role:kicker icon:AddPerson   "DM access"
    Text  h3                           "Allow Sam Palnet to DM the bot?"
    Card  subject
      Column
        Text  entity:{ship ~sampel-palnet, name "Sam Palnet"}   "Sam Palnet (~sampel-palnet)"
        Text                           "Hello, I would like to chat with your bot."
    Text  caption                      "The bot will be able to read and reply to future DMs from this user."
    Row   actions
      Button allow   primary      resultLabel "You allowed Sam Palnet to DM the bot."   statusLabel "Allowed"
      Button reject               resultLabel "You rejected Sam Palnet's request."      statusLabel "Rejected"
      Button ban     borderless tone:destructive  resultLabel "You blocked Sam Palnet." statusLabel "Blocked"
```

- **Channel access:** the subject card adds a `Row` with a caption (`Design · Garden Club`) and the borderless "View message" button, when the bot has a link target.
- **Group invite:** the subject card holds a group `entity` Text (`id` is the flag, `name` the title) and a footer `Row` with a caption ("Invited by Robin Dasler (~robin-dasler)").
- **Pending requests:** a kicker `Row` with `Text role:kicker icon:Mail "Pending requests"` and `Text role:status "2 waiting"`, the h3 title, then one nested `Card` per request: the requester `entity` Text ("Sam Palnet (~sampel-palnet)"), a caption with the reason ("wants to DM the bot"), the message, View message where the bot has a target, and the request's own button row. Separate cards replace today's dividers. At the four-request maximum this is about 47 components, inside the limit of 50 (today's tree is 48).

Old apps show each of these as today's cards with the same words, a little regrouped: the requester line and message sit in a white inner box, and "Sender:" and "Message:" labels are gone.

## What each bot changes

Both builders change the same way:

- `packages/openclaw/src/monitor/approval.ts`: `buildApprovalA2UIBlobFromParams` and `buildPendingApprovalsA2UIBlob` emit the shapes above; `makeA2UIBlob` (`packages/openclaw/src/urbit/blob.ts`) gains an option to set `storyMode: 'fallback'`.
- `packages/hermes-tlon-adapter/approval.py`: `build_approval_card` and `build_pending_approvals_card` emit the same shapes; `make_a2ui_blob_entry` gains the same option. The adapter's own validator, `validate_a2ui_card` (a Python port of `validateBlobEntry`), ignores keys it doesn't know, so the new fields pass it; extend it to check their types and lengths and to count `resultLabel` toward the text budget, so it stays as strict as the app.
- The result and status labels reuse the confirmation copy each bot already has (`format_confirmation` in the adapter, the matching acknowledgements in openclaw), written in the second person.
- Tests: the existing builder tests, plus a check that the four-request pending card stays under 50 components and that each tree passes `validateBlobEntry` with and without the new fields.

## Release order

1. **App and schema (one PR in this repo).** Add the fields to `packages/api/src/client/a2ui.ts` with lenient parsing and text-budget counting, draw them in `A2UIBlock`, and document them in `docs/tlon-apps/post-blobs.md`. Ships in a store build; there are no OTAs.
2. **Bots (two PRs: openclaw, hermes adapter).** They can merge once step 1 is merged, because old apps degrade gracefully either way. For a clean switch, wait until most active users run the step 1 build (check app version share in PostHog), since older builds will show the regrouped tree in the old style. Hosted bots pick up openclaw changes with the next plugin release.

## Decisions

1. **Success colour:** the theme's existing "positive" colour (blue). No new token.
2. **Button order:** the bots send Block, Reject, Allow. The renderer keeps the bot's order for non-primary buttons and puts the primary one last.
3. **Scope:** approvals and pending requests only for now. The hints are generic, so other cards can adopt them later without a format change.
4. **Result lines:** written by the bot (`resultLabel`), so they can name the requester.

## Risks

- A group invite's preview comes from the group's host. If that fails, the group row falls back to the bot's `name` and the flag.
- The answered state reflects the owner's tap, not the bot's success. The bot's confirmation message still follows separately, so a failure is visible there.
- Accessibility: an entity row's label is its fallback `text`, so screen readers get the same sentence old apps show.
