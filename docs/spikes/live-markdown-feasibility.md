# Native Input Feasibility (Tlon)

## TL;DR
This spike evaluates two approaches to replacing the current WebView/TipTap editor with a native input on mobile:

1. **`@expensify/react-native-live-markdown`** — markdown‑first input with live syntax highlighting. Feasible for a reduced feature set but supports a **smaller markdown surface** than the current editor (no lists, task lists, multi‑level headings, inline images). Outputs plain text.

2. **`react-native-enriched`** (Software Mansion) — native rich‑text input with programmatic formatting commands. Supports **full feature parity** (bold, italic, strike, headings 1‑6, ordered/unordered/checkbox lists, code blocks, blockquotes, links, inline images). Outputs plain text but formatting is applied via imperative API, not markdown syntax.

Both approaches require a **draft format migration** (from TipTap JSON to plain text/markdown), mention handling, and reference/paste logic rewrites. Neither is drop‑in, but `react-native-enriched` is the **stronger candidate** due to feature parity and toolbar compatibility.

## 1) Current WebView‑Based Input (Location + Usage)

**Core implementation**
- `packages/app/ui/components/MessageInput/index.tsx`  
  Uses `@10play/tentap-editor` `RichText` (WebView on native) with custom injected JS, editor bridge extensions, and message passing for paste/content height.
- `packages/editor/src/MessageInputEditor.tsx`  
  Web editor rendered inside the WebView. Uses `useTenTap` and posts paste events to native via `ReactNativeWebView`.
- `packages/editor/package.json` + `packages/editor/vite.config.ts`  
  Builds a single‑file HTML bundle (`editorHtml`) consumed by `MessageInput`.

**Usage sites**
- `packages/app/ui/components/BigInput.tsx`  
  Uses `MessageInput` for rich‑text mode (notebooks). Markdown mode uses `MarkdownEditor` (plain TextArea).
- `packages/app/ui/components/MessageInput/*` (toolbar, helpers, bridge hooks)  
  Rich‑text formatting, draft persistence, attachments, and webview lifecycle.
- Exported via `packages/app/ui/index.tsx` and used across mobile/web.

## 2) Compatibility: `@expensify/react-native-live-markdown`

**From upstream docs**
- New‑Architecture‑only (Fabric + TurboModules). citeturn2view1  
- Requires `react-native-reanimated >= 3.17.0`, `react-native-worklets`, `expensify-common`, and `html-entities`. citeturn2view1  
- Not supported in Expo Go (use Expo Dev Client). citeturn2view1  
- Supported platforms include iOS/Android/web. citeturn2view1  
- RN compatibility table shows **RN 0.76** supported for `0.1.141+` (current app is RN 0.76.9). citeturn2search6  

**App architecture fit**
- **RN 0.76.9 + New Architecture enabled** (`apps/tlon-mobile/android/gradle.properties` has `newArchEnabled=true`).
- **Expo Dev Client present**, so the “no Expo Go” requirement is compatible.
- **Potential dependency gap**: app uses `react-native-reanimated ~3.16.7` (needs upgrade to >=3.17.0). Other required deps aren’t present yet.

## 3) Blockers / Risks

**Feature parity**
- Current editor supports bold/italic/strike, links, headings 1‑6, lists, task lists, code blocks, blockquotes, images, and custom bridges. Toolbar includes list/heading/task/codeblock actions.
- Live‑markdown supports a **smaller syntax set**: bold, italic, strikethrough, emoji, mentions, link, inline code, pre, blockquote, h1, syntax. citeturn2view1  
  This is **not a drop‑in replacement** for lists, multi‑heading, tasks, tables, or inline images.

**Markdown flavor mismatch**
- Live‑markdown uses **ExpensiMark**, while Tlon uses **remark + GFM** (CommonMark‑style) for `markdownToStory` and `storyToMarkdown`.
- This can lead to parsing/rendering differences, especially for lists, tables, task lists, and mentions.

**Data model mismatch**
- Drafts and send pipeline currently rely on TipTap JSON (`JSONContent`) → `JSONToInlines`.
- Live‑markdown outputs **plain text**. You’ll need **markdown → Story/Content** conversion and draft migration (or a new draft format).

**Mentions**
- Current mentions rely on TipTap mention extension and a ship‑mention plugin (~zod). Live‑markdown supports mention tokens, but not the same semantics or metadata. Bridging mention selection + persistence will need custom logic.

**IME / selection / cursor stability**
- Live‑markdown performs parsing while typing. Needs validation with iOS/Android IME (multi‑stage composition), selection updates, and cursor jumps in long inputs.

**Paste / attachments / references**
- Current editor receives WebView `paste` events and runs reference extraction + attachment logic. Native text inputs lack reliable paste events, so you’ll need clipboard listeners or input‑diff heuristics.

**Accessibility**
- Rich text spans inside the input may impact screen readers. Needs explicit testing.

## 4) Incremental Migration Plan (Suggested)

1. **Integrate library behind a feature flag** (native‑only at first).  
   Use a new `LiveMarkdownMessageInput` and keep the existing WebView editor as default.
2. **Adapter layer**: markdown → `Story` → `content` on send; draft storage uses `storyToContent` and/or `diaryMixedToJSON`.  
   Decide on a **draft format** (markdown string vs TipTap JSON).
3. **Parity pass**: extend parsing/formatting rules to match existing Markdown features (lists, headings, tasks, tables, inline images).  
   If ExpensiMark is insufficient, supply a custom parser.
4. **Mentions**: implement ship‑mention parsing, mention popup integration, and insertion logic.
5. **Paste + references**: add clipboard detection and reference extraction on paste/insert.
6. **Replace toolbar actions** with markdown token insertion (wrap selection with `**`, `_`, backticks, etc.).
7. **Remove WebView / TipTap** dependencies once feature parity + QA is complete.

## 5) Spike Implementation

**Branch**: `spike-live-markdown-input`

### 5a) LiveMarkdownInput (Expensify)

**Files**
- `packages/app/ui/components/MessageInput/LiveMarkdownInput.native.tsx` — thin wrapper around `MarkdownTextInput` with `parseExpensiMark`.
- `packages/app/ui/components/MessageInput/LiveMarkdownInput.web.tsx` — web fallback using `TextArea`.
- `packages/app/ui/components/MessageInput/LiveMarkdownMessageInput.tsx` — minimal message input converting markdown → Story → content on send.

**Feature flag**: `liveMarkdownInput` (default: on for Tlon employees). When enabled, BigInput's markdown mode uses `LiveMarkdownInput` instead of the plain `MarkdownEditor` TextArea.

**Limitations**
- No lists, task lists, multi‑level headings, or inline images.
- No mention popup integration.
- Required peers (`react-native-worklets`, `expensify-common`, `html-entities`, reanimated ≥3.17) not yet added.

### 5b) EnrichedNoteInput (Software Mansion)

**Files**
- `packages/app/ui/components/MessageInput/EnrichedNoteInput.tsx` — wrapper around `react-native-enriched`'s `EnrichedTextInput` that exposes a `TlonEditorBridge`-compatible adapter. Supports bold, italic, strike, inline code, code blocks, blockquotes, ordered/unordered/checkbox lists, headings 1‑6, links, and inline images via imperative API.
- `packages/app/ui/components/MessageInput/EnrichedNoteInput.web.tsx` — web fallback using `TextArea`.
- `packages/app/ui/components/MessageInput/FormattingToolbar.tsx` — standalone formatting toolbar that takes explicit `editor` + `editorState` props (no tentap hooks). Works with both the enriched adapter and potentially any future editor that conforms to `TlonEditorBridge`.

**Feature flag**: `enrichedInput` (default: off). When enabled, BigInput renders `EnrichedNoteInput` + `FormattingToolbar` instead of the WebView/TipTap editor.

**Integration with BigInput**
- Uses the same markdown → Story send path as markdown mode (`markdownToStory` → `storyToContent`).
- `EnrichedNoteInput` emits plain text via `onChangeText`; BigInput stores it in `markdownContent`.
- `onEditorStateChange` provides reactive `TlonBridgeState` for toolbar active/disabled states.
- `onPasteImages` handles clipboard image uploads (same S3 upload flow as the TipTap editor).
- Inline image insertion via `editor.setImage(url, width, height)`.

**What works**
- All formatting toggles via the toolbar (bold, italic, strike, code, code block, blockquote, lists, headings, links).
- Inline image upload from image picker and clipboard paste.
- Theme‑aware styling (code blocks, blockquotes, lists match the app theme).
- Link insertion bar with URL input.

**Limitations**
- No mention popup integration.
- Draft content is plain text; existing TipTap JSON drafts won't migrate automatically.
- `onChangeText` returns plain text (not HTML/markdown with formatting) — the send path uses `markdownToStory` which won't preserve toolbar‑applied formatting. Full HTML → Story conversion is needed for production use.

### 5c) BigInput Integration

`BigInput.tsx` now supports three editor modes behind feature flags:

| Flag | Editor | Toolbar |
|------|--------|---------|
| (default) | TipTap WebView (`MessageInput`) | `InputToolbar` (tentap) |
| `liveMarkdownInput` | `LiveMarkdownInput` (markdown mode) | Markdown toggle only |
| `enrichedInput` | `EnrichedNoteInput` | `FormattingToolbar` |

A debug label is shown above the editor to indicate which mode is active.

### 5d) Other Changes

- Import path cleanups in `packages/api` and `packages/shared` (barrel → direct imports to help with tree‑shaking / Metro resolution).
- Added `react-native-enriched` dependency in `packages/app/package.json` and `apps/tlon-mobile/package.json`.

## 6) Recommendation

**`react-native-enriched` is the stronger candidate** for replacing the WebView editor:

| Criteria | live‑markdown | react-native-enriched |
|----------|--------------|----------------------|
| Formatting surface | Limited (bold, italic, strike, code, blockquote, h1) | Full (all of the above + lists, task lists, headings 1‑6, links, images) |
| Toolbar integration | Needs custom markdown token insertion | Imperative API maps directly to `TlonEditorBridge` |
| Output | Plain text (markdown) | Plain text (need HTML → Story for production) |
| Inline images | Not supported | Supported via `setImage()` |
| Paste handling | No reliable paste events | `onPasteImages` callback |
| Maturity | Maintained by Expensify, production‑used | Software Mansion, newer |

### Next steps (if proceeding with react-native-enriched)
1. Implement HTML/attributed‑text → Story conversion for the send path (so toolbar formatting is preserved).
2. Add mention support (ship‑mention parsing, popup, insertion).
3. Draft format migration (TipTap JSON → plain text or HTML).
4. Paste reference extraction.
5. Performance testing with long documents.
6. Remove WebView/TipTap dependencies once feature‑complete.

## Open Questions
- Is `react-native-enriched` stable enough for production? Need to evaluate crash reports and edge cases.
- Should we keep live‑markdown as an option for simpler markdown‑only inputs (e.g. chat messages vs notebooks)?
- Is it acceptable to migrate draft storage away from TipTap JSON? That simplifies the architecture but needs data migration.
