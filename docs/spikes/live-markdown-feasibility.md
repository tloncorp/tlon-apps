# Live Markdown Feasibility (Tlon)

## TL;DR
Replacing the current WebView/Tiptap editor with `@expensify/react-native-live-markdown` is **feasible only for a markdown‑first, reduced feature set**. The library is New‑Architecture‑only (which matches this app), but it supports a **smaller markdown surface** than the current editor (no lists, task lists, multi‑level headings, tables, inline images), and it outputs **plain text** rather than the TipTap JSON used throughout drafts/sending. A full replacement would require a **syntax/feature parity plan**, draft migration, mention handling, and reference/paste logic rewrites. I implemented a **minimal spike** on a new branch to prove integration, but it is **not drop‑in**.

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

## 5) Minimal Spike (Implemented)

**Branch**: `spike-live-markdown-input`

**What I added**
- `packages/app/ui/components/MessageInput/LiveMarkdownInput.native.tsx`  
  Thin wrapper around `MarkdownTextInput` with `parseExpensiMark`.
- `packages/app/ui/components/MessageInput/LiveMarkdownInput.web.tsx`  
  Web fallback using `TextArea` (explicit web implementation path).
- `packages/app/ui/components/MessageInput/LiveMarkdownMessageInput.tsx`  
  Minimal message input that uses live‑markdown, converts markdown → Story → content on send, and stores drafts by converting to TipTap JSON.
- `packages/app/fixtures/MessageInput.fixture.tsx`  
  Added a `liveMarkdown` fixture to preview the spike.
- Dependency added: `@expensify/react-native-live-markdown` in `packages/app/package.json` and `apps/tlon-mobile/package.json`.

**Spike limitations**
- No mention popup integration.
- No reference/attachment extraction on paste.
- Draft conversion is lossy for advanced TipTap blocks.
- Required dependencies (`react-native-worklets`, `expensify-common`, `html-entities`, and `react-native-reanimated >= 3.17`) are **not yet added/upgraded**.

## 6) Tests (Manual)

Since this is a spike, I did not run tests. Suggested manual checks:

1. Install deps (including required peers):
   - `pnpm install`
   - Add `react-native-worklets`, `expensify-common`, `html-entities`, and upgrade `react-native-reanimated` to `>=3.17.0`.
2. Open Cosmos fixture:
   - `pnpm run cosmos:native`
   - In the `MessageInput` fixture, choose `liveMarkdown`.
3. Validate:
   - Typing/formatting of `**bold**`, `*italic*`, `` `code` ``, `# heading`.
   - Send button enable/disable on empty content.
   - Cursor stability in long text.

## Open Questions
- Are lists/task lists/headings beyond H1 required for chat inputs on mobile? If yes, live‑markdown will need substantial parser extensions.
- Is it acceptable to migrate draft storage to markdown strings? That would simplify but needs data migration.
