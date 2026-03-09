# Action Button Post Blob Entry Type

## Concept

A new blob entry type `action-button` that carries a label and an arbitrary
Urbit poke payload. When rendered, each entry displays as a tappable button.
Pressing the button fires the embedded poke. This lets an LLM (or any automated
sender) attach structured actions to a message — e.g. "Approve" / "Deny"
buttons that poke the appropriate agent without the recipient typing anything.

## Entry shape (`action-button` v1)

| field | type | notes |
|-------|------|-------|
| `type` | `'action-button'` | discriminant |
| `version` | `1` | schema version |
| `label` | `string` | button text shown to user |
| `pokeApp` | `string` | Urbit app to poke (e.g. `'chat'`) |
| `pokeMark` | `string` | poke mark (e.g. `'chat-dm-action-1'`) |
| `pokeJson` | `unknown` (validated as JSON-serializable) | the poke payload |

A single post can carry multiple `action-button` entries (the blob is an
array), so you get a row of buttons under the message.

## Files to change

### 1. `packages/api/src/lib/content-helpers.ts` — Schema + write helpers

- Add `PostBlobDataEntryActionButtonSchema` using
  `definePostBlobDataEntrySchema('action-button', 1, { ... })`
- Export `PostBlobDataEntryActionButton` type
- Add schema to `postBlobDataEntryDefinitions`
- Add `appendActionButtonToPostBlob()` convenience function
- No `toPostData` case needed — action buttons won't originate from the
  attachment picker; they'll be appended to the blob directly by whatever
  creates the post (e.g. an LLM response handler)

### 2. `packages/api/src/lib/postContent.ts` — Read path + block type

- Add `ActionButtonBlockData` type:
  `{ type: 'action-button'; actionButton: PostBlobDataEntryActionButton }`
- Add to `BlockData` union
- Add `case 'action-button'` in `convertContent`'s blob loop
- Add `case 'action-button'` in `plaintextPreviewOf` (render as
  `"[Button: <label>]"`)

### 3. `packages/api/src/__tests__/content-helpers.test.ts` — Tests

- Round-trip test: `appendActionButtonToPostBlob` → `parsePostBlob` returns
  correct typed entry
- Malformed payload test: missing `label` or `pokeApp` → degrades to
  `{ type: 'unknown' }`
- Multiple buttons in one blob test
- Coexistence test: action buttons alongside file/voicememo entries

### 4. `packages/ui/` (or `packages/app/`) — Renderer component (later)

- Create an `ActionButtonBlock` component that renders the button and fires the
  poke on press
- The component receives `PostBlobDataEntryActionButton`, calls
  `poke({ app: entry.pokeApp, mark: entry.pokeMark, json: entry.pokeJson })`
  on tap
- Security consideration: may want a confirmation dialog or allowlist of
  pokeable apps

## What does NOT change

- **No backend (Hoon) changes** — blob is opaque `(unit @t)`
- **No attachment type changes** — action buttons aren't user-created
  attachments; they're programmatically injected into the blob
- **No `toPostData` case** — no attachment picker flow for these
- **No database schema changes** — blob column is already text

## Design considerations

### `pokeJson` validation

We use `z.unknown()` (must be JSON-serializable) rather than constraining the
shape. The blob system is client-opaque by design; constraining poke payloads
would couple the blob schema to every possible agent's action schema.

### Security

The poke executes with the recipient's identity. A malicious sender could embed
a poke that does something the recipient didn't intend. Options:

- **MVP**: No guard — treat like clicking a link (user sees the label, decides
  to press)
- **Later**: Confirmation modal showing the target app/mark before firing
- **Later**: Allowlist of safe app+mark combinations

### Immutability

Per design rule 5, blob is immutable after send. Buttons can't be removed or
change label/action after the post is sent. This is fine for the
approval/denial use case.

### Graceful degradation

Older clients that don't know `action-button` will render the standard "Upgrade
your app" blockquote — no crash.

## Execution order

1. Schema + helpers in `content-helpers.ts`
2. Block type + `convertContent` case in `postContent.ts`
3. Tests in `content-helpers.test.ts`
4. UI renderer (separate follow-up)
