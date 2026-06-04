# Live-markdown Editor Mentions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user/role @-mentions to the live-markdown notebook editor — a picker dropdown plus colored mention highlighting — with no fork and no dependency changes.

**Architecture:** Reuse the shared `useMentions` hook + `MessageInputContainer` popup for detection and selection. On select, insert *canonical* mention text (`~ship` / `@role` / `@all`) so the existing `markdownToStory`/`storyToMarkdown` round-trip serializes mentions with zero new conversion code. Highlight mentions by supplying a custom worklet `parser` to `MarkdownTextInput` that wraps `parseExpensiMark` and appends `mention-user` / `mention-here` ranges, styled via `markdownStyle`.

**Tech Stack:** React Native, `@expensify/react-native-live-markdown@0.1.327` (`MarkdownTextInput`, `parseExpensiMark`, `MarkdownRange`/`MarkdownStyle`), Tamagui, vitest, react-native-reanimated worklets.

---

## File Structure

- **Create** `packages/app/ui/components/MessageInput/mentionMarkdownRanges.ts` — pure, worklet-tagged `findMentionRanges(text)` that returns mention `MarkdownRange[]`. Single responsibility: text → mention ranges. Imported by both the parser and the test.
- **Create** `packages/app/ui/components/MessageInput/mentionMarkdownRanges.test.ts` — vitest unit tests for the scanner.
- **Modify** `packages/app/ui/components/MessageInput/LiveMarkdownInput.tsx` — custom worklet parser composing `parseExpensiMark` + `findMentionRanges`; accept + forward `markdownStyle`.
- **Modify** `packages/app/ui/components/MessageInput/LiveMarkdownInput.web.tsx` — accept (and ignore) `markdownStyle` so the prop type matches across platforms.
- **Modify** `packages/app/ui/components/BareChatInput/useMentions.tsx` — additionally return `mentionStartIndex` (additive; existing consumers unaffected).
- **Modify** `packages/app/ui/components/MessageInput/LiveMarkdownMessageInput.tsx` — wire `useMentions` (detection + popup), canonical-text insertion on select, theme-derived `markdownStyle`, read `groupRoles` prop.
- **Modify** `packages/app/ui/components/BigInput.tsx` — pass `groupRoles` (and `groupMembers`) to `LiveMarkdownMessageInput`.

---

## Task 1: Mention-range scanner + unit tests

**Files:**
- Create: `packages/app/ui/components/MessageInput/mentionMarkdownRanges.ts`
- Test: `packages/app/ui/components/MessageInput/mentionMarkdownRanges.test.ts`

The scanner mirrors `markdownToStory`'s mention detection so anything it highlights is something the serializer turns into a `{ ship }` / `{ sect }` inline:
- ships (`SHIP_PATTERN` in `packages/api/src/client/markdown/shipMentionPlugin.ts`): `~[a-z]{3,6}(?:-[a-z]{6})*` → `mention-user`
- groups/roles (`GROUP_MENTION_PATTERN` in `groupMentionPlugin.ts`): `@[a-z][a-z0-9-]*` where `@` is not preceded by an alphanumeric char → `mention-here`

The group pattern avoids regex lookbehind (not guaranteed in the worklet runtime) by checking the preceding character manually.

- [ ] **Step 1: Write the failing test**

Create `packages/app/ui/components/MessageInput/mentionMarkdownRanges.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { findMentionRanges } from './mentionMarkdownRanges';

describe('findMentionRanges', () => {
  it('detects a bare ship mention as mention-user', () => {
    expect(findMentionRanges('hi ~zod')).toEqual([
      { type: 'mention-user', start: 3, length: 4 },
    ]);
  });

  it('detects multiple ships on a line', () => {
    expect(findMentionRanges('~zod and ~bus')).toEqual([
      { type: 'mention-user', start: 0, length: 4 },
      { type: 'mention-user', start: 9, length: 4 },
    ]);
  });

  it('detects a planet ship with syllable groups', () => {
    expect(findMentionRanges('~sampel-palnet')).toEqual([
      { type: 'mention-user', start: 0, length: 14 },
    ]);
  });

  it('detects @all and @role as mention-here', () => {
    expect(findMentionRanges('ping @all and @admin')).toEqual([
      { type: 'mention-here', start: 5, length: 4 },
      { type: 'mention-here', start: 14, length: 6 },
    ]);
  });

  it('ignores @ inside an email-like token', () => {
    expect(findMentionRanges('mail me at foo@bar')).toEqual([]);
  });

  it('detects a group mention wrapped in punctuation', () => {
    expect(findMentionRanges('(@all)')).toEqual([
      { type: 'mention-here', start: 1, length: 4 },
    ]);
  });

  it('returns ranges sorted by start across both kinds', () => {
    expect(findMentionRanges('@all ~zod')).toEqual([
      { type: 'mention-here', start: 0, length: 4 },
      { type: 'mention-user', start: 5, length: 4 },
    ]);
  });

  it('returns nothing for plain text', () => {
    expect(findMentionRanges('just some text')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/app && pnpm exec vitest run ui/components/MessageInput/mentionMarkdownRanges.test.ts`
Expected: FAIL — `Failed to resolve import "./mentionMarkdownRanges"` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `packages/app/ui/components/MessageInput/mentionMarkdownRanges.ts`:

```ts
import type { MarkdownRange } from '@expensify/react-native-live-markdown';

// Mirrors markdownToStory's mention detection (packages/api/src/client/markdown/
// shipMentionPlugin.ts + groupMentionPlugin.ts) so every range we highlight is a
// substring the serializer turns into a { ship } / { sect } inline.
//   ~ship        -> 'mention-user'
//   @role / @all  -> 'mention-here'
// Tagged 'worklet' so it can be called from the MarkdownTextInput parser worklet;
// the directive is an inert string when run off-worklet (e.g. in tests).
export function findMentionRanges(text: string): MarkdownRange[] {
  'worklet';
  const ranges: MarkdownRange[] = [];

  const shipRe = /~[a-z]{3,6}(?:-[a-z]{6})*/g;
  let shipMatch: RegExpExecArray | null;
  while ((shipMatch = shipRe.exec(text)) !== null) {
    ranges.push({
      type: 'mention-user',
      start: shipMatch.index,
      length: shipMatch[0].length,
    });
  }

  // `@` not preceded by an alphanumeric char (rejects emails/ids like foo@bar),
  // matching groupMentionPlugin's negative lookbehind without using lookbehind.
  const groupRe = /@[a-z][a-z0-9-]*/g;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupRe.exec(text)) !== null) {
    const prev = groupMatch.index > 0 ? text[groupMatch.index - 1] : '';
    if (prev !== '' && /[A-Za-z0-9]/.test(prev)) {
      continue;
    }
    ranges.push({
      type: 'mention-here',
      start: groupMatch.index,
      length: groupMatch[0].length,
    });
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/app && pnpm exec vitest run ui/components/MessageInput/mentionMarkdownRanges.test.ts`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/app/ui/components/MessageInput/mentionMarkdownRanges.ts packages/app/ui/components/MessageInput/mentionMarkdownRanges.test.ts
git commit -m "feat(notebooks): add mention-range scanner for live-markdown editor"
```

---

## Task 2: Expose `mentionStartIndex` from `useMentions`

The canonical-text insertion (Task 5) needs the trigger index. The hook tracks it as `mentionStartIndex` but does not return it. This is additive — `BareChatInput` ignores the extra field.

**Files:**
- Modify: `packages/app/ui/components/BareChatInput/useMentions.tsx` (return object, ~line 303)

- [ ] **Step 1: Add `mentionStartIndex` to the returned object**

In the `return { ... }` at the end of `useMentions`, add `mentionStartIndex` alongside the existing fields:

```ts
  return {
    mentions,
    validOptions,
    setMentions,
    mentionSearchText,
    setMentionSearchText,
    mentionStartIndex,
    handleMention,
    handleSelectMention,
    isMentionModeActive,
    setIsMentionModeActive,
    handleMentionEscape,
    hasMentionCandidates,
    resetMentionMode,
  };
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/app && pnpm exec tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 3: Commit**

```bash
git add packages/app/ui/components/BareChatInput/useMentions.tsx
git commit -m "feat(mentions): expose mentionStartIndex from useMentions"
```

---

## Task 3: Custom worklet parser + `markdownStyle` in `LiveMarkdownInput`

**Files:**
- Modify: `packages/app/ui/components/MessageInput/LiveMarkdownInput.tsx`
- Modify: `packages/app/ui/components/MessageInput/LiveMarkdownInput.web.tsx`

- [ ] **Step 1: Replace `LiveMarkdownInput.tsx` with the custom parser + markdownStyle passthrough**

```tsx
import {
  MarkdownTextInput,
  parseExpensiMark,
} from '@expensify/react-native-live-markdown';
import type {
  MarkdownRange,
  MarkdownStyle,
} from '@expensify/react-native-live-markdown';
import { forwardRef, memo } from 'react';
import type { TextInput, TextInputProps } from 'react-native';

import { findMentionRanges } from './mentionMarkdownRanges';

export type LiveMarkdownInputProps = TextInputProps & {
  markdownStyle?: MarkdownStyle;
};

// Worklet parser: base ExpensiMark styling + Tlon ship/role mention ranges.
function parseTlonMarkdown(text: string): MarkdownRange[] {
  'worklet';
  const base = parseExpensiMark(text);
  const mentions = findMentionRanges(text);
  return base.concat(mentions).sort((a, b) => a.start - b.start);
}

export const LiveMarkdownInput = memo(
  forwardRef<TextInput, LiveMarkdownInputProps>(
    ({ multiline = true, markdownStyle, ...props }, ref) => {
      return (
        <MarkdownTextInput
          // MarkdownTextInput's ref type is narrower than TextInput; the wrapper
          // exposes the public TextInput ref.
          ref={ref as any}
          {...props}
          multiline={multiline}
          parser={parseTlonMarkdown}
          markdownStyle={markdownStyle}
        />
      );
    }
  )
);

LiveMarkdownInput.displayName = 'LiveMarkdownInput';
```

- [ ] **Step 2: Update the web fallback to accept (and ignore) `markdownStyle`**

In `LiveMarkdownInput.web.tsx`, add `markdownStyle` to the prop type and destructure it out so it is not spread onto the DOM. Concretely, change the props type to intersect `{ markdownStyle?: unknown }` and destructure `markdownStyle` in the component signature (discarding it). Example signature:

```tsx
export type LiveMarkdownInputProps = TextInputProps & { markdownStyle?: unknown };

export const LiveMarkdownInput = forwardRef<TextInput, LiveMarkdownInputProps>(
  ({ markdownStyle: _markdownStyle, ...props }, ref) => {
    // ...existing TextArea fallback, using {...props} (without markdownStyle)
  }
);
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/app && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/app/ui/components/MessageInput/LiveMarkdownInput.tsx packages/app/ui/components/MessageInput/LiveMarkdownInput.web.tsx
git commit -m "feat(notebooks): highlight mentions via custom live-markdown parser"
```

---

## Task 4: Thread `groupRoles`/`groupMembers` from `BigInput`

`LiveMarkdownMessageInput` needs `groupRoles` for role mention options. `BigInput` already receives `groupMembers` / `groupRoles` (destructured at its signature) — forward them to the live-markdown branch.

**Files:**
- Modify: `packages/app/ui/components/BigInput.tsx` (the `liveMarkdownEnabled ? ( <LiveMarkdownMessageInput ... /> )` render branch)

- [ ] **Step 1: Pass the props in the live-markdown render branch**

Locate the `<LiveMarkdownMessageInput ... />` element in `BigInput.tsx` and add the two props (alongside the existing ones it shares with `MessageInput`):

```tsx
              <LiveMarkdownMessageInput
                // ...existing props...
                groupMembers={groupMembers}
                groupRoles={groupRoles}
              />
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/app && pnpm exec tsc --noEmit`
Expected: PASS (`groupMembers`/`groupRoles` are part of `MessageInputProps`).

- [ ] **Step 3: Commit**

```bash
git add packages/app/ui/components/BigInput.tsx
git commit -m "feat(notebooks): pass group roles/members to live-markdown editor"
```

---

## Task 5: Wire the mention picker + canonical insertion in `LiveMarkdownMessageInput`

**Files:**
- Modify: `packages/app/ui/components/MessageInput/LiveMarkdownMessageInput.tsx`

Canonical text inserted on select:
- contact → `preSig(option.id)` (sig-prefixed ship, e.g. `~sampel-palnet`)
- all (`option.id === ALL_MENTION_ID`, which is `'-all-'`) → `@all`
- other role → `@${option.id}`

`mdastToStory` maps `@all` → `{ sect: null }` and `@role` → `{ sect: role }`; `markdownToStory` maps `~ship` → `{ ship }`. So inserting canonical text is all that send/draft serialization needs.

- [ ] **Step 1: Add imports**

Add to the imports in `LiveMarkdownMessageInput.tsx`:

```tsx
import { preSig } from '@tloncorp/api/lib/urbit';
import {
  ALL_MENTION_ID,
  MentionOption,
  createMentionRoleOptions,
  useMentions,
} from '../BareChatInput/useMentions';
import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
```

Also ensure `useMemo` is imported from `react` (add it to the existing `react` import if missing).

- [ ] **Step 2: Read `groupRoles` from props**

Add `groupRoles` to the destructured props of `LiveMarkdownMessageInput` (it is part of `MessageInputProps`):

```tsx
  groupRoles,
```

- [ ] **Step 3: Instantiate the hook, selection state, and theme markdownStyle**

Inside the component body (after the existing `useState` declarations), add:

```tsx
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  const roleOptions = useMemo(
    () => createMentionRoleOptions(groupRoles ?? []),
    [groupRoles]
  );

  const {
    isMentionModeActive,
    mentionSearchText,
    validOptions,
    mentionStartIndex,
    handleMention,
    resetMentionMode,
  } = useMentions({ chatId: channelId, roleOptions });

  const markdownStyle = useMemo<MarkdownStyle>(
    () => ({
      mentionUser: {
        color: theme.positiveActionText.val,
        backgroundColor: theme.positiveBackground.val,
      },
      mentionHere: {
        color: theme.positiveActionText.val,
        backgroundColor: theme.positiveBackground.val,
      },
    }),
    [theme]
  );
```

(`theme` already exists via `const theme = useTheme();`.)

- [ ] **Step 4: Add change, selection, and mention-select handlers**

`handleMention(text, next)` is called without an explicit cursor, using the
hook's diff-based heuristic — the same approach `BareChatInput` uses on native,
which is more robust than relying on `onSelectionChange` ordering. (This refines
the spec's explicit-cursor suggestion.) The controlled `selection` prop is used
only as a one-shot to place the caret after an inserted mention, then released.

```tsx
  const handleChangeText = useCallback(
    (next: string) => {
      handleMention(text, next);
      setText(next);
    },
    [text, handleMention]
  );

  const handleSelectionChange = useCallback(() => {
    // Release the one-shot controlled selection set after inserting a mention,
    // so the caret is free to move on the next interaction.
    setSelection((prev) => (prev ? undefined : prev));
  }, []);

  const onSelectMention = useCallback(
    (option: MentionOption) => {
      if (mentionStartIndex == null) {
        return;
      }
      const canonical =
        option.type === 'contact'
          ? preSig(option.id)
          : option.id === ALL_MENTION_ID
            ? '@all'
            : `@${option.id}`;
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(
        mentionStartIndex + 1 + mentionSearchText.length
      );
      const inserted = `${canonical} `;
      const newText = before + inserted + after;
      const caret = before.length + inserted.length;
      setText(newText);
      setSelection({ start: caret, end: caret });
      resetMentionMode();
    },
    [text, mentionStartIndex, mentionSearchText, resetMentionMode]
  );
```

- [ ] **Step 5: Pass mention props to `MessageInputContainer` and the input**

Replace the existing `mentionOptions={[]}` / `onSelectMention={() => {}}` on `MessageInputContainer` with the real values:

```tsx
      mentionOptions={validOptions}
      onSelectMention={onSelectMention}
      isMentionModeActive={isMentionModeActive}
      mentionText={mentionSearchText}
```

And update the `<LiveMarkdownInput ... />` element to use the new handlers + style + controlled selection:

```tsx
          <LiveMarkdownInput
            ref={inputRef}
            value={text}
            onChangeText={handleChangeText}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            markdownStyle={markdownStyle}
            placeholder={placeholder}
            // ...existing style / multiline / onContentSizeChange props...
          />
```

- [ ] **Step 6: Typecheck**

Run: `cd packages/app && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Run the scanner test again (sanity, fast)**

Run: `cd packages/app && pnpm exec vitest run ui/components/MessageInput/mentionMarkdownRanges.test.ts`
Expected: PASS (8 passed).

- [ ] **Step 8: Commit**

```bash
git add packages/app/ui/components/MessageInput/LiveMarkdownMessageInput.tsx
git commit -m "feat(notebooks): mention picker + canonical insertion in live-markdown editor"
```

---

## Task 6: Build + on-device validation (iOS)

No new unit tests here — this validates the worklet parser and picker on a device, which unit tests cannot cover.

**Preconditions:** iOS sim running the dev build; Metro on its port; `liveMarkdownInput` flag enabled (toggle via the dev editor switcher, or temporarily set its `featureMeta` default to `true` and revert after).

- [ ] **Step 1: Typecheck the package**

Run: `cd packages/app && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Reload the app and open a notebook post in the live-markdown editor**

Confirm the debug label/switcher shows `live-markdown`.

- [ ] **Step 3: Verify the picker**

Type `@` then a query → the mention dropdown appears with members and roles. Select a member → confirm `~ship` text is inserted (canonical, not the nickname) with a trailing space and the caret after it. Repeat with a role → `@role`, and with "All" → `@all`.

- [ ] **Step 4: Verify highlighting**

Confirm inserted `~ship` / `@role` / `@all` render with the mention color (`$positiveActionText` on `$positiveBackground`). Check that `~zod ... ~bus` are each highlighted and not mis-rendered as strikethrough, and that a mention inside bold (`**~zod**`) renders sanely.

- [ ] **Step 5: Verify round-trip**

Save/post the note, then re-open it for editing. Confirm mentions reload as `~ship` / `@role` / `@all` text (via `storyToMarkdown`) and render highlighted. Confirm the posted note shows the mention as a proper mention (rendered by the post content renderer).

- [ ] **Step 6: Report results**

Capture a screenshot of the editor with a member mention, a role mention, and `@all`, plus the rendered posted note. Summarize pass/fail per step.
