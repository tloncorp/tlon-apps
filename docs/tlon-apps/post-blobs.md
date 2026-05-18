# Post Blobs

Post blobs are a sidecar field on posts used for structured metadata that the backend treats as opaque text. The blob ships alongside post `content` and `meta`, but all blob semantics live in the client. The same blob field is used for both channel posts and chat messages.

## Wire format

On the wire and in the database, the blob is nullable text containing a JSON-stringified array of typed, versioned entries:

```ts
blob = JSON.stringify(PostBlobDataEntry[])
```

When no extra data is needed, the field is `null` (`blob=~` in Hoon).

## Entry schema

Blob entries are a discriminated union keyed on `type` and `version`. Definitions live in `packages/api/src/lib/content-helpers.ts` and are registered in `postBlobDataEntryDefinitions`, which drives both write-time validation and read-time parsing.

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

## Read/write behavior

- Writes happen through helpers in `packages/api/src/lib/content-helpers.ts`. `appendToPostBlob` is the base helper; `appendFileUploadToPostBlob` and `appendVideoToPostBlob` are convenience wrappers.
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
6. Unknown or malformed entries degrade to `{ type: 'unknown' }` so older clients fail gracefully instead of crashing.

## Adding a new entry type

1. Add a named schema and inferred type in `packages/api/src/lib/content-helpers.ts`.
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
