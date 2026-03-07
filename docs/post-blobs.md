# Post Blobs

Post blobs are a sidecar data field on posts used to carry structured metadata
that the backend treats as opaque text. The blob ships alongside the post's
`content` (Story) and `meta` (Metadata) but is never interpreted by the Hoon
agents — it is serialized JSON read and written entirely by the client.

## Wire format

On the wire and in the database the blob is a **nullable text column** holding a
JSON-stringified array of typed, versioned entries:

```
blob = JSON.stringify(PostBlobDataEntry[])
```

When no extra data is needed the field is `null` (Hoon: `blob=~`).

## Entry schema

Every element in the array is a **discriminated union** keyed on `type` +
`version`. A generic helper enforces the shape:

```ts
// packages/api/src/lib/content-helpers.ts:546-553
type BuildPostBlobDataEntry<
  Type extends string,
  Config extends { version: number },
  Payload extends Record<string, unknown>,
> = {
  type: Type;
  version: Config['version'];
} & Payload;
```

The current entry types, all at **version 1**, are defined at
`packages/api/src/lib/content-helpers.ts:559-603`:

### `file` v1

Metadata for a generic file upload (non-image, non-video).

| field      | type                | notes          |
|------------|---------------------|----------------|
| `type`     | `'file'`            | discriminant   |
| `version`  | `1`                 | schema version |
| `fileUri`  | `string`            | uploaded URI   |
| `mimeType` | `string` (optional) |                |
| `name`     | `string` (optional) | display name   |
| `size`     | `number`            | bytes          |

### `voicememo` v1

Metadata for a voice recording.

| field             | type                  | notes                   |
|-------------------|-----------------------|-------------------------|
| `type`            | `'voicememo'`         | discriminant            |
| `version`         | `1`                   | schema version          |
| `fileUri`         | `string`              | uploaded URI             |
| `size`            | `number`              | bytes                   |
| `transcription`   | `string` (optional)   | speech-to-text result   |
| `waveformPreview` | `number[]` (optional) | values between 0 and 1  |
| `duration`        | `number` (optional)   | seconds                 |

### `video` v1

Metadata for an uploaded video.

| field       | type                | notes                            |
|-------------|---------------------|----------------------------------|
| `type`      | `'video'`           | discriminant                     |
| `version`   | `1`                 | schema version                   |
| `fileUri`   | `string`            | uploaded URI                     |
| `mimeType`  | `string` (optional) |                                  |
| `name`      | `string` (optional) | display name                     |
| `size`      | `number`            | bytes                            |
| `width`     | `number` (optional) | pixels                           |
| `height`    | `number` (optional) | pixels                           |
| `duration`  | `number` (optional) | seconds                          |
| `posterUri` | `string` (optional) | preview thumbnail URI            |

## Where the types live

| artifact | location |
|----------|----------|
| `PostBlobDataEntry` union type | `packages/api/src/lib/content-helpers.ts:559` |
| `PostBlobData` (internal array alias) | `packages/api/src/lib/content-helpers.ts:605` |
| `ClientPostBlobData` (parsed, includes `{type:'unknown'}`) | `packages/api/src/lib/content-helpers.ts:684` |
| `BuildPostBlobDataEntry` generic helper | `packages/api/src/lib/content-helpers.ts:546` |

## Callsites

### Backend (Hoon)

The blob is an opaque optional text field (`(unit @t)`) on the `essay` structure
in both channel posts and chat messages. The backend stores and relays it but
never inspects its contents.

| file | line | definition |
|------|------|------------|
| `desk/sur/channels.hoon` | 112 | `blob=(unit @t)` on `$essay` |
| `desk/sur/chat-5.hoon` | 71 | `blob=(unit @t)` on `$essay` |
| `desk/sur/chat-4.hoon` | 71 | `blob=(unit @t)` on `$essay` |
| `desk/tests/app/channels-server.hoon` | 43 | `blob=~` (null in tests) |

### Urbit TypeScript types

| file | line | type |
|------|------|------|
| `packages/api/src/urbit/channel.ts` | 114-121 | `PostEssay.blob: string \| null` |

### Serialization (write path)

These functions build the blob string from attachment data.

| function | file | line | purpose |
|----------|------|------|---------|
| `appendToPostBlob` | `packages/api/src/lib/content-helpers.ts` | 607 | Parse existing blob JSON, push a new entry, re-serialize. Base function used by all writers. |
| `appendFileUploadToPostBlob` | `packages/api/src/lib/content-helpers.ts` | 631 | Convenience wrapper: creates a `file` v1 entry and appends. |
| `appendVideoToPostBlob` | `packages/api/src/lib/content-helpers.ts` | 651 | Convenience wrapper: creates a `video` v1 entry and appends. |
| `toPostData` | `packages/api/src/lib/content-helpers.ts` | 707 | Iterates finalized attachments; calls the above functions to produce the blob. Also builds `story` and `metadata`. Returns `{ story, metadata, blob? }`. |

`toPostData` routes each attachment type as follows
(`packages/api/src/lib/content-helpers.ts:732-803`):

| attachment type | blob function called | story block? |
|-----------------|----------------------|-------------|
| `file` | `appendFileUploadToPostBlob` | no |
| `voicememo` | `appendToPostBlob` (inline entry) | no |
| `video` | `appendVideoToPostBlob` | no |
| `image` | — | yes (`{image: ...}` block) |
| `reference` | — | yes (reference block) |
| `link` | — | yes (link block) |

### Deserialization (read path)

| function | file | line | purpose |
|----------|------|------|---------|
| `parsePostBlob` | `packages/api/src/lib/content-helpers.ts` | 686 | `JSON.parse` the blob string, validate each entry by `type`+`version`, return `ClientPostBlobData`. Unrecognized entries become `{type:'unknown'}`. |
| `convertContent` | `packages/api/src/lib/postContent.ts` | 349 | Calls `parsePostBlob`, then converts each entry to a `PostContent` block for rendering: `file` → `FileUploadBlockData`, `voicememo` → `VoiceMemoBlockData`, `video` → `VideoBlockData`, `unknown` → blockquote ("Upgrade your app to see this post"). |

### API transport

| function | file | line | purpose |
|----------|------|------|---------|
| `toPostEssay` | `packages/api/src/client/apiUtils.ts` | 164 | Constructs `PostEssay` with `blob: blob \|\| null` for poke to backend. |
| `sendPost` | `packages/api/src/client/postsApi.ts` | 138 | Accepts `blob?: string`, passes to `toPostEssay` (channels) or inlines into `WritDeltaAdd` (DMs). |
| `editPost` | `packages/api/src/client/postsApi.ts` | 204 | Accepts `blob?: string`, passes to `toPostEssay` for channel post edits. |
| `toPostData` (API→DB) | `packages/api/src/client/postsApi.ts` | 1343 | Extracts `post.essay.blob ?? null` when converting server response to local post record. |

### Database & model builders

| function | file | line | purpose |
|----------|------|------|---------|
| `posts.blob` column | `packages/shared/src/db/schema.ts` | 1127 | `text('blob')` — nullable text column on the `posts` table. |
| `buildPostUpdate` | `packages/shared/src/db/modelBuilders.ts` | 135 | Accepts optional `blob`, includes in the update partial. |
| `buildPost` | `packages/shared/src/db/modelBuilders.ts` | 168 | Accepts optional `blob`, passes through `buildPostUpdate`. |

### Store layer

All blob threading through the store happens in
`packages/shared/src/store/postActions.ts`:

| line(s) | context |
|---------|---------|
| 93-96 | `finalizePostDraft` calls `toPostData`, destructures `blob` from result. |
| 98-103 | Blob included in `PostDataFinalized` object. |
| 126-134 | `finalizePostDraftLocal` — same pattern for optimistic local finalization. |
| 251-253 | Optimistic post insert: blob passed to `buildPost`. |
| 291-293 | Post update after finalization: blob passed to `buildPostUpdate`. |
| 324-327 | `sendPost` API call: blob passed to `api.sendPost`. |
| 614-616 | Edit flow optimistic update: blob included in `db.updatePost`. |
| 634 | Edit API call: uses `postBeforeEdit.blob` — **blob is not editable**. |

### Post data types

| type | file | line | blob field |
|------|------|------|-----------|
| `_PostDataFinalizedBase` | `packages/api/src/types/post.ts` | 30 | `blob?: string` |
| `PostDataFinalizedParent` | `packages/api/src/types/post.ts` | 41 | (inherits from base) |
| `PostDataFinalizedEdit` | `packages/api/src/types/post.ts` | 45 | (inherits from base) |

Note: `PostDataDraft` does **not** have a blob field. The blob is computed
during finalization from the draft's attachments.

## Design rules

1. **Always versioned.** Every entry carries `type` and `version`. To change a
   shape, bump the version and add a new union branch — never mutate an existing
   version in place.

2. **Array, not object.** The top-level value is always an array so a single
   post can carry multiple blob entries (e.g. two file uploads).

3. **Backend-opaque.** The Hoon agents treat blob as `(unit @t)`. They never
   parse or validate its contents. All semantics live in the client.

4. **Immutable after send.** Blob is not editable; the edit flow preserves the
   original blob from the pre-edit post
   (`postActions.ts:634`). Attachments carried in the blob cannot be added,
   removed, or modified via post editing.

5. **Graceful degradation.** Unrecognized entry types are parsed as
   `{type:'unknown'}` and rendered as an "Upgrade your app" blockquote so older
   clients don't crash on new entry types.

6. **Blob ≠ content.** Media that the backend can natively represent (images,
   references, links) goes in the Story `content` field as blocks. Blob is
   reserved for data the backend schema cannot express — file metadata, voice
   memo waveforms, video dimensions, poster thumbnails, etc.

## Adding a new entry type

1. Add a new branch to the `PostBlobDataEntry` union in
   `packages/api/src/lib/content-helpers.ts` using `BuildPostBlobDataEntry`.
   Choose a unique `type` string and set `version: 1`.

2. Add an `appendXToPostBlob` convenience function following the pattern of
   `appendFileUploadToPostBlob` / `appendVideoToPostBlob`.

3. In `toPostData` (`content-helpers.ts:707`), add a `case` for the new
   attachment type that calls your append function.

4. In `parsePostBlob` (`content-helpers.ts:686`), add a validation branch for
   `entry.type === 'yourtype' && entry.version === 1`.

5. In `convertContent` (`postContent.ts:349`), add a `case` that maps the
   parsed entry to the appropriate `PostContent` block type for rendering.

6. No backend changes are needed — the Hoon agents pass blob through unchanged.
