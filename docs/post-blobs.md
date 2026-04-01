# Post Blobs

Post blobs are a sidecar data field on posts used to carry structured metadata that the backend treats as opaque text. The blob ships alongside the post's `content` (Story) and `meta` (Metadata) — it is serialized JSON.

## Wire format

On the wire and in the database the blob is a **nullable text column** holding a JSON-stringified array of typed, versioned entries:

```
blob = JSON.stringify(PostBlobDataEntry[])
```

When no extra data is needed the field is `null` (Hoon: `blob=~`).

## Entry schema

Every element in the array is a **discriminated union** keyed on `type` + `version`. The client defines these entries in a shared Zod-backed registry so the same schema validates both writes and reads:

```ts
// packages/api/src/lib/content-helpers.ts
function definePostBlobDataEntrySchema<Type extends string, Version extends number, Payload extends z.ZodRawShape>(type: Type, version: Version, payload: Payload) {
    return z.object({
        type: z.literal(type),
        version: z.literal(version),
        ...payload,
    });
}
```

Each concrete blob entry should have its own named schema and inferred type (for example `PostBlobDataEntryFileSchema` and `PostBlobDataEntryFile`), then be added to the `postBlobDataEntryDefinitions` tuple. `PostBlobDataEntry` is the union inferred from `PostBlobDataEntrySchema`. The current entry types, all at **version 1**, are:

### `file` v1

Metadata for a generic file upload (non-image, non-video).

| field      | type                | notes          |
| ---------- | ------------------- | -------------- |
| `type`     | `'file'`            | discriminant   |
| `version`  | `1`                 | schema version |
| `fileUri`  | `string`            | uploaded URI   |
| `mimeType` | `string` (optional) |                |
| `name`     | `string` (optional) | display name   |
| `size`     | `number`            | bytes          |

### `voicememo` v1

Metadata for a voice recording.

| field             | type                  | notes                  |
| ----------------- | --------------------- | ---------------------- |
| `type`            | `'voicememo'`         | discriminant           |
| `version`         | `1`                   | schema version         |
| `fileUri`         | `string`              | uploaded URI           |
| `size`            | `number`              | bytes                  |
| `transcription`   | `string` (optional)   | speech-to-text result  |
| `waveformPreview` | `number[]` (optional) | values between 0 and 1 |
| `duration`        | `number` (optional)   | seconds                |

## Where the types live

| artifact                                                          | location                                      |
| ----------------------------------------------------------------- | --------------------------------------------- |
| `definePostBlobDataEntrySchema` helper                            | `packages/api/src/lib/content-helpers.ts:546` |
| `safeParseArrayWithFallback` helper                               | `packages/api/src/lib/content-helpers.ts:562` |
| `PostBlobDataEntryFileSchema` / `PostBlobDataEntryFile`           | `packages/api/src/lib/content-helpers.ts:577` |
| `PostBlobDataEntryVoiceMemoSchema` / `PostBlobDataEntryVoiceMemo` | `packages/api/src/lib/content-helpers.ts:592` |
| `postBlobDataEntryDefinitions` registry                           | `packages/api/src/lib/content-helpers.ts:611` |
| `PostBlobDataEntrySchema` / `PostBlobDataEntry`                   | `packages/api/src/lib/content-helpers.ts:616` |
| `ClientPostBlobData` (parsed, includes `{type:'unknown'}`)        | `packages/api/src/lib/content-helpers.ts:673` |

## Callsites

### Backend (Hoon)

The blob is an opaque optional text field (`(unit @t)`) on the `essay` structure in both channel posts and chat messages. The backend stores and relays it but never inspects its contents.

| file                                  | line | definition                   |
| ------------------------------------- | ---- | ---------------------------- |
| `desk/sur/channels.hoon`              | 112  | `blob=(unit @t)` on `$essay` |
| `desk/sur/chat-5.hoon`                | 71   | `blob=(unit @t)` on `$essay` |
| `desk/sur/chat-4.hoon`                | 71   | `blob=(unit @t)` on `$essay` |
| `desk/tests/app/channels-server.hoon` | 43   | `blob=~` (null in tests)     |

### Urbit TypeScript types

| file                                | line    | type                             |
| ----------------------------------- | ------- | -------------------------------- |
| `packages/api/src/urbit/channel.ts` | 114-121 | `PostEssay.blob: string \| null` |

### Serialization (write path)

These functions build the blob string from attachment data.

| function                     | file                                      | line | purpose                                                                                                                                               |
| ---------------------------- | ----------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appendToPostBlob`           | `packages/api/src/lib/content-helpers.ts` | 624  | Validates a new entry against the union schema, parses any existing blob array, appends, and re-serializes. Base function used by all writers.        |
| `appendFileUploadToPostBlob` | `packages/api/src/lib/content-helpers.ts` | 653  | Convenience wrapper: creates a `file` v1 entry and appends.                                                                                           |
| `toPostData`                 | `packages/api/src/lib/content-helpers.ts` | 694  | Iterates finalized attachments; calls the blob helpers to produce the blob. Also builds `story` and `metadata`. Returns `{ story, metadata, blob? }`. |

`toPostData` routes each attachment type as follows (`packages/api/src/lib/content-helpers.ts`):

| attachment type | blob function called              | story block?               |
| --------------- | --------------------------------- | -------------------------- |
| `file`          | `appendFileUploadToPostBlob`      | no                         |
| `voicememo`     | `appendToPostBlob` (inline entry) | no                         |
| `image`         | —                                 | yes (`{image: ...}` block) |
| `reference`     | —                                 | yes (reference block)      |
| `link`          | —                                 | yes (link block)           |

### Deserialization (read path)

| function         | file                                      | line | purpose                                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parsePostBlob`  | `packages/api/src/lib/content-helpers.ts` | 678  | Safely parses the blob JSON, then validates each element with `safeParseArrayWithFallback` and returns `ClientPostBlobData`. Malformed or unrecognized entries become `{type:'unknown'}`.                                 |
| `convertContent` | `packages/api/src/lib/postContent.ts`     | 347  | Calls `parsePostBlob`, then converts each entry to a `PostContent` block for rendering: `file` → `FileUploadBlockData`, `voicememo` → `VoiceMemoBlockData`, `unknown` → blockquote ("Upgrade your app to see this post"). |

### API transport

| function              | file                                  | line | purpose                                                                                           |
| --------------------- | ------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| `toPostEssay`         | `packages/api/src/client/apiUtils.ts` | 164  | Constructs `PostEssay` with `blob: blob \|\| null` for poke to backend.                           |
| `sendPost`            | `packages/api/src/client/postsApi.ts` | 138  | Accepts `blob?: string`, passes to `toPostEssay` (channels) or inlines into `WritDeltaAdd` (DMs). |
| `editPost`            | `packages/api/src/client/postsApi.ts` | 204  | Accepts `blob?: string`, passes to `toPostEssay` for channel post edits.                          |
| `toPostData` (API→DB) | `packages/api/src/client/postsApi.ts` | 1343 | Extracts `post.essay.blob ?? null` when converting server response to local post record.          |

### Database & model builders

| function            | file                                      | line | purpose                                                     |
| ------------------- | ----------------------------------------- | ---- | ----------------------------------------------------------- |
| `posts.blob` column | `packages/shared/src/db/schema.ts`        | 1127 | `text('blob')` — nullable text column on the `posts` table. |
| `buildPostUpdate`   | `packages/shared/src/db/modelBuilders.ts` | 135  | Accepts optional `blob`, includes in the update partial.    |
| `buildPost`         | `packages/shared/src/db/modelBuilders.ts` | 168  | Accepts optional `blob`, passes through `buildPostUpdate`.  |

### Store layer

All blob threading through the store happens in `packages/shared/src/store/postActions.ts`:

| line(s) | context                                                                    |
| ------- | -------------------------------------------------------------------------- |
| 93-96   | `finalizePostDraft` calls `toPostData`, destructures `blob` from result.   |
| 98-103  | Blob included in `PostDataFinalized` object.                               |
| 126-134 | `finalizePostDraftLocal` — same pattern for optimistic local finalization. |
| 251-253 | Optimistic post insert: blob passed to `buildPost`.                        |
| 291-293 | Post update after finalization: blob passed to `buildPostUpdate`.          |
| 324-327 | `sendPost` API call: blob passed to `api.sendPost`.                        |
| 614-616 | Edit flow optimistic update: blob included in `db.updatePost`.             |
| 634     | Edit API call: uses `postBeforeEdit.blob` — **blob is not editable**.      |

### Post data types

| type                      | file                             | line | blob field           |
| ------------------------- | -------------------------------- | ---- | -------------------- |
| `_PostDataFinalizedBase`  | `packages/api/src/types/post.ts` | 30   | `blob?: string`      |
| `PostDataFinalizedParent` | `packages/api/src/types/post.ts` | 41   | (inherits from base) |
| `PostDataFinalizedEdit`   | `packages/api/src/types/post.ts` | 45   | (inherits from base) |

Note: `PostDataDraft` does **not** have a blob field. The blob is computed during finalization from the draft's attachments.

## Design rules

1. **Always versioned.** Every entry carries `type` and `version`. To change a shape, bump the version and add a new schema entry for that version — never mutate an existing version in place.

2. **Schema-first.** Add every entry type to `postBlobDataEntryDefinitions` using `definePostBlobDataEntrySchema`. The same registry drives write validation in `appendToPostBlob` and read validation in `parsePostBlob`.

3. **Array, not object.** The top-level value is always an array so a single post can carry multiple blob entries (e.g. two file uploads).

4. **Backend-opaque.** The Hoon agents treat blob as `(unit @t)`. They never parse or validate its contents. All semantics live in the client.

5. **Immutable after send.** Blob is not editable; the edit flow preserves the original blob from the pre-edit post in `postActions.ts`. Attachments carried in the blob cannot be added, removed, or modified via post editing.

6. **Graceful degradation.** Unrecognized entry types are parsed as `{type:'unknown'}` and rendered as an "Upgrade your app" blockquote so older clients don't crash on new entry types.

7. **Blob ≠ content.** Media that the backend can natively represent (images, references, links) goes in the Story `content` field as blocks. Blob is reserved for data the backend schema cannot express — currently file metadata and voice memo metadata.

## Adding a new entry type

1. Add a new named schema and named inferred type in `packages/api/src/lib/content-helpers.ts`, for example: `const PostBlobDataEntryYourTypeSchema = definePostBlobDataEntrySchema(...)` and `type PostBlobDataEntryYourType = z.infer<typeof ...>`. Choose a unique `type` string and start at `version: 1`.

2. Add that schema to `postBlobDataEntryDefinitions`. `PostBlobDataEntry` will update automatically from the union schema. Add an `appendXToPostBlob` convenience function if the new entry type will be written from more than one place.

3. In `toPostData` (`content-helpers.ts:694`), add a `case` for the new attachment type that calls your append function.

4. You do **not** add a manual `parsePostBlob` branch. Once the schema is in the registry, `parsePostBlob` will validate it automatically on read.

5. In `convertContent` (`postContent.ts:347`), add a `case` that maps the parsed entry to the appropriate `PostContent` block type for rendering.

6. Add tests for both the happy path and malformed payloads. The existing `packages/api/src/__tests__/content-helpers.test.ts` file covers the current pattern.

7. No backend changes are needed — the Hoon agents pass blob through unchanged.
