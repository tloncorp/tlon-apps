# Live-markdown editor: user mentions

Date: 2026-06-03
Status: Approved (design)

## Purpose

Add user/role @-mentions to the live-markdown notebook editor
(`LiveMarkdownMessageInput`, built on `@expensify/react-native-live-markdown`'s
`MarkdownTextInput`). Two capabilities:

1. A **picker**: typing `@`/`~` opens the existing mention dropdown of group
   members and roles; selecting one inserts the mention into the text.
2. **Formatting**: mentions render as highlighted/accented text inside the input
   via a custom markdown parser.

No fork of `@expensify/react-native-live-markdown` and no change to
`package.json` dependencies. The editor is native-only (already gated off web).

## Background

- The live-markdown editor serializes content with `markdownToStory(text)` (on
  send and draft) and loads with `storyToMarkdown(story)`. These conversions
  already pattern-detect mentions: `~ship` ↔ `{ ship }` and `@role` / `@all` ↔
  `{ sect }`. So mentions round-trip to/from Urbit story format with no new
  serialization code, **provided the text contains canonical mention syntax**.
- `useMentions` (`packages/app/ui/components/BareChatInput/useMentions.tsx`) is
  the shared hook for trigger detection + candidate querying. `MentionPopup` /
  `InputMentionPopup` (rendered by `MessageInputContainer`) is the shared UI.
- The library exposes a public `parser: (text: string) => MarkdownRange[]` prop
  (a worklet), the range types `mention-user` / `mention-here`, and
  `markdownStyle.mentionUser` / `mentionHere` style slots. This is sufficient
  for mention highlighting without touching native code.

## Scope

In scope:

- Mention trigger detection + candidate dropdown in `LiveMarkdownMessageInput`.
- Inserting canonical mention text on selection.
- A custom worklet parser that highlights mention ranges.
- Mention styling derived from the Tamagui theme.
- Unit tests for the mention-range scanner.

Out of scope:

- Rounded "pill" components mid-text. The library styles text ranges
  (color + background), not embedded components. Mentions render as accented
  text (e.g. a colored `~zod`). This matches the library's capability and
  Expensify's own @mention styling.
- Web key navigation (arrow keys / Enter) in the popup — the editor is
  native-only; selection is tap-only.
- Hiding the `~` / `@` syntax characters. A live-markdown input shows raw
  markdown with styling layered on; the trigger char stays visible as part of
  the highlighted mention.

## Architecture

Three additive units, all on the JS side.

### 1. Mention detection + picker (in `LiveMarkdownMessageInput.tsx`)

- Instantiate `useMentions({ chatId: channelId, roleOptions:
  createMentionRoleOptions(groupRoles) })`. Requires `channelId` (already a
  prop) and `groupRoles` (thread through from `MessageInputProps`).
- Track the caret with `MarkdownTextInput`'s `onSelectionChange` (it is a
  `TextInput` subclass), and pass the caret as the explicit cursor to
  `handleMention(oldText, newText, cursor)` from `onChangeText`. Explicit cursor
  is more reliable than the diff heuristic the hook falls back to.
- Feed the popup through `MessageInputContainer` (it already renders
  `InputMentionPopup`): pass `isMentionModeActive`, `mentionText`,
  `mentionOptions={validOptions}`, `onSelectMention`. Replace the current
  `mentionOptions={[]}` / `onSelectMention={() => {}}` stubs.

### 2. Canonical mention insertion

The shared `handleSelectMention` inserts the *friendly* display (e.g.
`@Nickname` for a nicknamed contact, capitalized `@All`), which
`markdownToStory` would mis-parse or miss. The live-markdown editor must instead
insert **canonical** text so the existing round-trip works:

- contact → `~ship` (sig-prefixed ship id, never the nickname)
- role → `@role-id`
- all → `@all` (lowercase)

To build the replacement we need the trigger start index. `useMentions`
computes it internally as `mentionStartIndex` but does not return it. Add
`mentionStartIndex` to the hook's return value (additive; does not affect
`BareChatInput`). Then in the component: `before = text.slice(0,
mentionStartIndex)`, `after = text.slice(mentionStartIndex + searchText.length +
1)`, `newText = before + canonical + ' ' + after`; set text and move the caret
to after the inserted mention + space (via the `selection` prop). Reset mention
mode after insertion.

### 3. Custom worklet parser (in `LiveMarkdownInput.tsx`)

```js
function parseTlonMarkdown(text) {
  'worklet';
  const ranges = parseExpensiMark(text);   // base markdown styling
  // scan text mirroring markdownToStory's mention regexes:
  //   ~ship          -> { type: 'mention-user', start, length }
  //   @role / @all    -> { type: 'mention-here', start, length }
  // append those ranges; sort the combined list by `start`.
  return ranges;
}
```

- Ship regex mirrors `remarkShipMentions`: `~[a-z]{3,6}(?:-[a-z]{6})*`.
- Role/all regex mirrors `remarkGroupMentions`:
  `(?<![A-Za-z0-9])@([a-z][a-z0-9-]*)` (lookbehind support to be confirmed in
  the worklet/Hermes; fall back to a manual preceding-char check if unsupported).
- Wire `parser={parseTlonMarkdown}` and add `markdownStyle={{ mentionUser, mentionHere }}`
  on the `MarkdownTextInput`, with colors from the Tamagui theme (accent text +
  subtle background).

`MarkdownRange` shape: `{ type, start, length, depth?, syntaxType? }`.

## Data flow

```
keypress
  -> onChangeText(newText) + onSelectionChange(caret)
  -> useMentions.handleMention(old, new, caret)
       -> isMentionModeActive / mentionSearchText / validOptions
  -> MessageInputContainer renders InputMentionPopup(options=validOptions)
  -> user taps option
  -> insert canonical ~ship/@role/@all at mentionStartIndex; setText; move caret
  -> (every render) parser worklet styles mention ranges in the input
  -> on send: markdownToStory(text) -> { ship } / { sect } inlines -> storyToContent
```

## Testing

- Unit-test the mention-range scanner (the pure part of the parser, factored so
  it can run off-worklet in tests): given input text, assert it returns the
  expected `mention-user` / `mention-here` ranges (correct start/length),
  including: a bare `~zod`, multiple ships on a line, `@all`, a `@role`, a
  mention adjacent to punctuation, and non-mentions left untouched (e.g. an
  email-like `a@b`, a `~~strike~~`).
- Confirm parity with `markdownToStory`: any substring the scanner flags as a
  mention is one that `markdownToStory` turns into a `{ ship }` / `{ sect }`
  inline (shared regexes / fixtures).
- On-device validation (agent-device, iOS): trigger the picker, select a
  member and a role, verify canonical text is inserted, verify highlighting,
  verify a sent post renders the mention. Check `~zod ... ~bus` is not
  mis-styled as strikethrough and overlaps (mention inside bold) render sanely.

## Risks

- **Worklet constraints**: the parser runs on the UI thread. Regex is supported
  in Hermes worklets; `parseExpensiMark` is already workletized. Lookbehind in
  the role regex may not be supported — use a manual boundary check if needed.
- **ExpensiMark strikethrough**: `~~text~~` is strikethrough; single-`~` ship
  mentions should not collide, but verify on device.
- **Range overlap/ordering**: appended mention ranges must be sorted with the
  base ranges; verify the native renderer handles overlaps (mention inside bold).

## Files touched

- `packages/app/ui/components/MessageInput/LiveMarkdownInput.tsx` — custom
  parser + `markdownStyle`.
- `packages/app/ui/components/MessageInput/LiveMarkdownMessageInput.tsx` — picker
  wiring (detection, popup, canonical insertion); thread `groupRoles`.
- `packages/app/ui/components/BareChatInput/useMentions.tsx` — return
  `mentionStartIndex` (additive).
- A new module for the mention-range scanner + its unit test (so the scan logic
  is testable off-worklet).
- `packages/app/ui/components/BigInput.tsx` — pass `groupRoles` (and any missing
  props) to `LiveMarkdownMessageInput` if not already forwarded.
