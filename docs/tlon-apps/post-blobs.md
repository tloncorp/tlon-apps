# Post Blobs

Post blobs are a sidecar field on posts used for structured metadata that the backend treats as opaque text. The blob ships alongside post `content` and `meta`, but all blob semantics live in the client. The same blob field is used for both channel posts and chat messages.

## Wire format

On the wire and in the database, the blob is nullable text containing a JSON-stringified array of typed, versioned entries:

```ts
blob = JSON.stringify(PostBlobDataEntry[])
```

When no extra data is needed, the field is `null` (`blob=~` in Hoon).

## Entry schema

Blob entries are a discriminated union keyed on `type` and `version`. Definitions live in `packages/api/src/client/content-helpers.ts` and are registered in `postBlobDataEntryDefinitions`, which drives both write-time validation and read-time parsing.

Each concrete entry type should have:

- a named schema, for example `PostBlobDataEntryFileSchema`
- a named inferred type, for example `PostBlobDataEntryFile`
- a registration entry in `postBlobDataEntryDefinitions`

Current entry types:

### `file` v1

Generic file upload metadata.

| field      | type                |
| ---------- | ------------------- |
| `type`     | `'file'`            |
| `version`  | `1`                 |
| `fileUri`  | `string`            |
| `mimeType` | `string` (optional) |
| `name`     | `string` (optional) |
| `size`     | `number`            |

### `voicememo` v1

Voice recording metadata.

| field             | type                  |
| ----------------- | --------------------- |
| `type`            | `'voicememo'`         |
| `version`         | `1`                   |
| `fileUri`         | `string`              |
| `size`            | `number`              |
| `transcription`   | `string` (optional)   |
| `waveformPreview` | `number[]` (optional) |
| `duration`        | `number` (optional)   |

### `video` v1

Video upload metadata.

| field       | type                |
| ----------- | ------------------- |
| `type`      | `'video'`           |
| `version`   | `1`                 |
| `fileUri`   | `string`            |
| `mimeType`  | `string` (optional) |
| `name`      | `string` (optional) |
| `size`      | `number`            |
| `width`     | `number` (optional) |
| `height`    | `number` (optional) |
| `duration`  | `number` (optional) |
| `posterUri` | `string` (optional) |

### `metadata` v1

Optional, non-rendering context for selective enhancement by clients or other
consumers. The container does not contribute message text, attachment blocks,
or an upgrade notice.

| field     | type                      |
| --------- | ------------------------- |
| `type`    | `'metadata'`              |
| `version` | `1`                       |
| `data`    | `Record<string, unknown>` |

`data` maps namespaced keys to opaque JSON payloads. For example, a future
producer could advertise its client identity as follows:

```json
{
  "type": "metadata",
  "version": 1,
  "data": {
    "tlon.client": {
      "version": 1,
      "platform": "ios",
      "appVersion": "<release>"
    }
  }
}
```

This is an illustrative payload, not a client-identity contract or an active
producer. This release adds reader support only; clients do not emit metadata.
Wait for broad deployment of this reader baseline before introducing producers:
clients predating it will still render an upgrade notice for `metadata` entries.

The shared parser validates the container and preserves its namespace payloads
without interpreting them. Consumers must validate the namespace and payload
version they understand and ignore unknown, unsupported, or malformed payloads.
Keep the outer container stable and version each namespace's payload as needed.
An unsupported outer version or malformed metadata container is skipped on read,
without affecting sibling blob entries. Invalid JSON or a non-array blob still
uses the ordinary unknown-content fallback because entries cannot be recovered.

Metadata is untrusted optional context, not authorization or agent instructions.
Consumers must not render or execute arbitrary payloads. Required user-visible
content belongs in Story or a content blob entry, not in this container.

### `tlon-context-lens` v1

Pointer to a bot run record ("context lens"). Written by the OpenClaw Tlon gateway when it stamps a bot reply; the client uses it to look up the full run record (trigger, tool calls, timings, output). The blob carries only the public-safe pointer — run data itself stays on the gateway (and later the owner's ship) with owner-only visibility.

| field     | type                  |
| --------- | --------------------- |
| `type`    | `'tlon-context-lens'` |
| `version` | `1`                   |
| `lensId`  | `string`              |
| `botShip` | `string` (optional)   |

`botShip` identifies which ship hosts the bot that produced the run, so clients can resolve the run record when the gateway is unreachable.

### `a2ui` v1

A2UI presentation metadata. This lets a post carry a small validated A2UI v0.9 component tree alongside normal text content.

Definitions and validation helpers live in `packages/api/src/client/a2ui.ts`; the entry is registered with the shared blob union through `A2UI.blobEntrySchema`.

| field      | type               |
| ---------- | ------------------ |
| `type`     | `'a2ui'`           |
| `version`  | `1`                |
| `messages`  | `A2UI.Message[]`        |
| `recipe`    | `unknown` optional      |
| `storyMode` | `'fallback'` optional   |

With `storyMode: 'fallback'`, the post's text is a fallback for clients that can't draw the card, and is hidden under a rendered card.

The current renderer expects one `createSurface` message and one `updateComponents` message in the entry. The `updateComponents` message describes the component tree rendered for that post. It does not update surfaces in previous messages or elsewhere in message history.

The supported v1 client subset is intentionally small:

- components: `Card`, `Column`, `Row`, `Text`, `Divider`, `Button`, `Choice`,
  `SmallChoice`, and `McpConnect`
- button actions:
  - `tlon.sendMessage`, which sends explicit action text in the current DM
  - `tlon.navigate`, which can navigate to a message, channel, group, profile, chat details, chat volume, MCP settings, or a browser credential handoff screen
    - message reply targets should include `parentAuthorId` when `parentId` is not already prefixed as `~author/id`
- rendering policy: A2UI blocks render only in direct messages for now
- validation limits: component count, tree depth, text length, and expanded render size

#### Rendering hints

Optional fields that tell newer apps how to draw a component. Older apps strip
them and draw the component as before, so every hinted component keeps
readable text. Each hint parses leniently: a value an app doesn't know drops
that hint, never the card. The renderer reads components from the raw message,
so it reads hints only through `A2UI.getTextHints` and `A2UI.getButtonHints`.
Hints count toward the text budget.

| field | on | values | drawn as |
| --- | --- | --- | --- |
| `role` | `Text` | `'kicker'`, `'status'` | Kicker: the card's kind at its top. Status: the card's state beside it. |
| `icon` | `Text` with `role: 'kicker'` | `AddPerson`, `Channel`, `ChannelMultiDM`, `ChannelNotebooks`, `Clock`, `Link`, `Lock`, `Mail` | An icon before the kicker. |
| `entity` | `Text` | `{ type: 'ship' \| 'group', id, name? }` | A person or group row from the app's own contacts or group preview; `name` is used when the app has nothing better. Plain text right after a person or group row lines up under the name. |
| `tone` | `Button` | `'destructive'` | A red label. |
| `resultLabel` | `Button` | string | Once the button is used, replaces its card's button row. |
| `statusLabel` | `Button` | string | Once the button is used, shown as its card's status. |

A nested `Card` draws as a bordered inner card. A card's answer is scoped to
the buttons of that card, not of cards inside it, so each request in a list
answers on its own. See `docs/tlon-apps/a2ui-approval-cards.md` for how the
approval and pending-request cards use these.

`McpConnect` is a client-populated menu rather than bot-authored provider data.
The blob supplies only bounded presentation labels and three validated actions:

- `action`: navigate to the MCP settings screen, optionally focused on a provider
- `configureAction`: send the selected connected provider ids to the onboarding coordinator
- `completionAction`: optional send-message action that advances the conversation

The client obtains the provider catalog and current grants from Hosting. It does
not trust provider names, URLs, grant state, or availability from the post. A
provider row either opens the normal authorization flow or toggles an already
connected provider for the group; configuration is applied only when the owner
submits it. The completion action is one-shot and remains disabled when a live
`tlon-a2ui-selection` receipt exists for that surface and component.

### Browser credential handoff

A trusted bot can offer a standard A2UI card that opens a native Tlon
credential form for an existing hosted-browser session. Keep the hierarchy
quiet: one clear title, a short explanation, two short privacy lines, and one
explicit action. The card carries the session's signed viewer URL, not
credentials. Bots should create this card with
the `browser handoff <session_id>` tool instead of constructing the blob.
The `browserSecureEntry` target requires service-managed result delivery.
Unsupported screen targets fail validation before the owner can fill anything:

```json
[
  { "id": "root", "component": "Card", "child": "body" },
  {
    "id": "body",
    "component": "Column",
    "children": [
      "title",
      "title-divider",
      "explanation",
      "privacy-direct",
      "privacy-context",
      "action-divider",
      "actions"
    ]
  },
  {
    "id": "title",
    "component": "Text",
    "variant": "h3",
    "text": "Sign in to continue"
  },
  { "id": "title-divider", "component": "Divider" },
  {
    "id": "explanation",
    "component": "Text",
    "text": "The browser reached a login screen that needs your input."
  },
  {
    "id": "privacy-direct",
    "component": "Text",
    "variant": "caption",
    "text": "Your credentials go directly to the live browser."
  },
  {
    "id": "privacy-context",
    "component": "Text",
    "variant": "caption",
    "text": "They are never posted to chat or returned to the bot."
  },
  { "id": "action-divider", "component": "Divider" },
  {
    "id": "actions",
    "component": "Row",
    "children": ["open-login"],
    "align": "center"
  },
  {
    "id": "open-login",
    "component": "Button",
    "weight": 1,
    "variant": "primary",
    "child": "open-login-label",
    "action": {
      "event": {
        "name": "tlon.navigate",
        "context": {
          "target": {
            "type": "screen",
            "screen": "browserSecureEntry",
            "viewerUrl": "https://browser-session-ovh1.tlon.network/s/<signed-capability>"
          }
        }
      }
    }
  },
  {
    "id": "open-login-label",
    "component": "Text",
    "text": "Open secure login"
  }
]
```

The screen accepts signed viewer URLs from
`browser-session-*.tlon.network` and
`browser-session-*.test.tlon.systems`. It exchanges that capability directly
with the viewer gateway for a one-use, short-lived fill handle, displays the
origin of the login form discovered in the live browser, and posts the user's
values directly to the gateway. Passwords and usernames are never written to
the post blob, chat, bot context, or fill response.

The bot keeps the browser session live while the card is usable. The OpenClaw
result service resumes the originating conversation after entry or cancellation.
The card has no chat continuation action.

## Read/write behavior

- Writes happen through helpers in `packages/api/src/client/content-helpers.ts`. `appendToPostBlob` is the base helper; `appendFileUploadToPostBlob` and `appendVideoToPostBlob` are convenience wrappers.
- `toPostData` builds blobs from finalized attachments.
- `PostDataDraft` does not store `blob`; blob is computed during finalization from attachments.
- The edit transport can carry a blob, but current frontend edit flows do not implement blob editing. Network edits preserve the original blob.
- `parsePostBlob` reads blob JSON and validates each entry against the registered union schema.
- `convertContent` maps parsed entries into renderable `PostContent` blocks.
- The backend stores and relays `blob` but does not inspect it.

## Design rules

1. Every entry is versioned. To change a shape, add a new schema version rather than mutating an existing one.
2. The registry is the source of truth. Add new entry types to `postBlobDataEntryDefinitions`; do not add ad hoc parse branches elsewhere.
3. The top-level blob value is always an array so a post can carry multiple blob entries.
4. Blob is for data the backend schema cannot represent directly. Content the backend already knows how to encode, such as images, references, and links, should stay in Story content.
5. Current frontend policy is to treat blob as immutable in edit flows. The backend transport can carry a blob on edit, but the frontend preserves the original blob until explicit blob-edit support exists.
6. Unknown or malformed content entries degrade to `{ type: 'unknown' }` so older clients fail gracefully instead of crashing. Entries identified as `metadata` are the exception: malformed or unsupported containers are skipped without an upgrade notice.

## Adding a new entry type

1. Add a named schema and inferred type in `packages/api/src/client/content-helpers.ts`.
2. Add that schema to `postBlobDataEntryDefinitions`.
3. Add an `appendXToPostBlob` helper if the new entry will be written from more than one place.
4. Update the relevant attachment unions in `packages/api/src/types/attachment.ts` so the new entry can be finalized and passed into `toPostData`.
5. Update `toPostData` to write the new entry type.
6. Update `convertContent` to render the parsed entry.
7. Register the new block in `packages/app/ui/components/PostContent/BlockRenderer.tsx` so the default renderer path can display it.
8. Add tests for valid payloads and malformed payloads.

### Example pattern

For a new `etherscan-tx` entry, the schema/helper shape should look roughly like this:

```ts
const PostBlobDataEntryEtherscanTxSchema = definePostBlobDataEntrySchema(
  'etherscan-tx',
  1,
  {
    txHash: z.string().min(1),
    chainId: z.number().int().nonnegative(),
  }
);

type PostBlobDataEntryEtherscanTx = z.infer<
  typeof PostBlobDataEntryEtherscanTxSchema
>;

const postBlobDataEntryDefinitions = [
  PostBlobDataEntryFileSchema,
  PostBlobDataEntryVoiceMemoSchema,
  PostBlobDataEntryVideoSchema,
  PostBlobDataEntryEtherscanTxSchema,
] as const;

export function appendEtherscanTxToPostBlob(
  blob: string | undefined,
  opts: { txHash: string; chainId: number }
) {
  return appendToPostBlob(blob, {
    type: 'etherscan-tx',
    version: 1,
    ...opts,
  });
}
```

`PostBlobDataEntry` is inferred from `PostBlobDataEntrySchema`, so adding the schema to `postBlobDataEntryDefinitions` updates the shared union automatically.

No backend changes are needed. The backend continues to treat blob as opaque text.
