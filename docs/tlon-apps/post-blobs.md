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
| `messages` | `A2UI.Message[]`   |
| `recipe`   | `unknown` optional |

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

### Browser cards v1

`browser-session` and `browser-secure-entry` entries render built-in app cards
on web, iOS, and Android. The sender supplies data, not an A2UI layout:

```json
{
  "type": "browser-secure-entry",
  "version": 1,
  "viewerUrl": "https://browser-session.tlon.network/s/<signed-capability>",
  "presentation": { "purpose": "login", "site": "wikipedia.org" }
}
```

Both entries require `viewerUrl`. Secure entry accepts optional `presentation`
(`purpose`: `login`, `otp`, or `details`; `site`: hostname) and optional
`loginApproval` (`record`: optional `{id, revision}` saved-login pointer).
No credential values, account names, or form selectors belong in these blobs.
The service supplies the presentation from the prepared form; an older service
without presentation metadata gets a generic secure-entry card.

Only the owner's trusted bot can enable the card's actions or preview requests.
The client validates the viewer origin and uses the existing owner-authorized
viewer/credential flow. The site label is presentation, never authorization.
Session cards open the viewer modal/sheet; secure-entry cards open the existing
native input sheet or web modal. Login, OTP, and saved-login approval use distinct
copy. Closing a sheet does not consume the card.

The `tlon browser` delivery command writes these entries with a plain Story
fallback. Clients predating these entry types show that fallback and the normal
upgrade notice; ship reader support before updating hosted senders. Existing
A2UI secure-entry cards and rich session links remain supported. The fixtures
send these same typed blobs through the real chat renderer.

The signed capability identifies the form/session; the browser service still
owns expiry, owner authorization, field binding, and result delivery. No Hoon
change is required.

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
