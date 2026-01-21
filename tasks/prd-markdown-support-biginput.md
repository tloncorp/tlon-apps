# PRD: Markdown Support in BigInput Editor

## Introduction

Add a dedicated Markdown editing mode to the BigInput editor (Notebook/Gallery posts) that allows users to toggle between rich text (WYSIWYG) and raw Markdown views. The system will bidirectionally convert between Markdown syntax and the `Story` format used by the Urbit backend and message renderers, enabling users who prefer Markdown to compose content in their preferred syntax while maintaining full compatibility with the existing content pipeline.

## Goals

- Provide a toggle to switch between rich text and Markdown editing modes in BigInput
- Support full CommonMark syntax including inline formatting, headers, code blocks, lists, images, and task lists
- Implement bidirectional conversion: Markdown ↔ Story format
- Enable on-the-fly Markdown-to-rich-text conversion when switching modes
- Preserve content fidelity when round-tripping between formats
- Maintain compatibility with existing post rendering and storage

## User Stories

### US-001: Add Markdown mode toggle to BigInput toolbar
**Description:** As a user, I want to toggle between rich text and Markdown modes so I can choose my preferred editing experience.

**Acceptance Criteria:**
- [ ] Toggle button added to BigInput toolbar (icon: code/markdown symbol)
- [ ] Toggle state persists for the duration of the editing session
- [ ] Current mode is visually indicated (e.g., active state on toggle)
- [ ] Toggle is disabled during content conversion to prevent data loss
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Implement Markdown editor view
**Description:** As a user, I want to edit raw Markdown in a plain text editor when Markdown mode is active.

**Acceptance Criteria:**
- [ ] Markdown mode displays a monospace plain-text editor
- [ ] Editor supports standard text editing (selection, undo/redo, copy/paste)
- [ ] Markdown syntax is displayed as-is (not rendered)
- [ ] Editor maintains cursor position where possible when toggling modes
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Convert Story to Markdown (Story → Markdown)
**Description:** As a developer, I need to convert existing Story content to Markdown syntax so users can edit posts in Markdown mode.

**Acceptance Criteria:**
- [ ] Function `storyToMarkdown(story: Story): string` implemented in `packages/shared/src/logic/`
- [ ] Converts `VerseInline` to appropriate Markdown (bold → `**text**`, italic → `*text*`, etc.)
- [ ] Converts `VerseBlock` types: headers → `#`, code blocks → fenced code, images → `![alt](src)`, lists → `-`/`1.`, blockquotes → `>`, rules → `---`, task lists → `- [ ]`/`- [x]`
- [ ] Handles nested inline formatting (e.g., bold within italic)
- [ ] Preserves line breaks and paragraph structure
- [ ] Unit tests cover all Inline and Block types
- [ ] Typecheck passes

### US-004: Convert Markdown to Story (Markdown → Story)
**Description:** As a developer, I need to parse Markdown and convert it to the Story format so Markdown content can be saved and rendered.

**Acceptance Criteria:**
- [ ] Function `markdownToStory(markdown: string): Story` implemented in `packages/shared/src/logic/`
- [ ] Parses CommonMark syntax using a standard parser (e.g., `marked`, `remark`, or `markdown-it`)
- [ ] Maps Markdown AST to Story `Verse[]` structure
- [ ] Inline mappings: `**bold**` → `Bold`, `*italic*` → `Italics`, `` `code` `` → `InlineCode`, `[text](url)` → `Link`, `~~strike~~` → `Strikethrough`
- [ ] Block mappings: `#`-`######` → `Header`, fenced code → `Code`, `>` → `Blockquote`, `---` → `Rule`, `![](url)` → `Image`, `-`/`1.` → `List`, `- [ ]` → `Task`
- [ ] Handles @mentions (`~ship`) as `Ship` inline type
- [ ] Unit tests verify round-trip fidelity (Markdown → Story → Markdown)
- [ ] Typecheck passes

### US-005: Integrate mode toggle with content conversion
**Description:** As a user, I want my content to be converted when I switch modes so I can seamlessly move between editing experiences.

**Acceptance Criteria:**
- [ ] Switching from rich text → Markdown calls `storyToMarkdown` and populates Markdown editor
- [ ] Switching from Markdown → rich text calls `markdownToStory` and updates Tiptap editor
- [ ] Conversion errors display user-friendly message and prevent mode switch
- [ ] Unsaved content is not lost during conversion
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-006: Handle on-the-fly Markdown conversion in rich text mode
**Description:** As a user typing in rich text mode, I want common Markdown shortcuts to auto-convert so I can use familiar syntax without switching modes.

**Acceptance Criteria:**
- [ ] Typing `**text**` followed by space converts to bold and removes asterisks
- [ ] Typing `*text*` followed by space converts to italic
- [ ] Typing `` `text` `` followed by space converts to inline code
- [ ] Typing `# ` at line start converts to H1 (and `##` → H2, etc.)
- [ ] Typing `- ` or `1. ` at line start starts a list
- [ ] Typing `> ` at line start creates blockquote
- [ ] Typing `---` followed by Enter creates horizontal rule
- [ ] These behaviors can be disabled via user preference (future enhancement, out of scope for MVP)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Preserve images and attachments during conversion
**Description:** As a user, I want images and attachments to be preserved when switching between modes.

**Acceptance Criteria:**
- [ ] Header image (Notebook) preserved during mode switches
- [ ] Inline images converted to `![alt](src)` in Markdown
- [ ] `![alt](src)` syntax parsed back to `Image` blocks
- [ ] Image dimensions preserved when available
- [ ] Attachments referenced via `BlockReference` handled gracefully
- [ ] Typecheck passes

### US-008: Handle @mentions and channel references
**Description:** As a user, I want @mentions to work in both modes so I can reference other users.

**Acceptance Criteria:**
- [ ] `~ship-name` in Markdown converts to `Ship` inline type
- [ ] `Ship` inline type converts to `~ship-name` in Markdown output
- [ ] Mention autocomplete works in rich text mode (existing behavior)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Support task lists in Markdown mode
**Description:** As a user, I want to create task lists using `- [ ]` syntax in Markdown.

**Acceptance Criteria:**
- [ ] `- [ ] task` converts to unchecked `Task` type
- [ ] `- [x] task` converts to checked `Task` type
- [ ] `Task` types convert back to `- [ ]`/`- [x]` syntax
- [ ] Tasks render with checkboxes in rich text mode
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Edit existing posts in Markdown mode
**Description:** As a user, I want to edit existing Notebook/Gallery posts in Markdown mode.

**Acceptance Criteria:**
- [ ] When editing a post, `editingPost.content` (Story) is converted to Markdown if Markdown mode selected
- [ ] Changes made in Markdown mode are saved correctly as Story format
- [ ] Title and header image editing works independently of content mode
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Add `storyToMarkdown(story: Story): string` function to `packages/shared/src/logic/`
- FR-2: Add `markdownToStory(markdown: string): Story` function to `packages/shared/src/logic/`
- FR-3: Add Markdown mode toggle button to BigInput toolbar
- FR-4: Implement plain-text Markdown editor component for Markdown mode
- FR-5: Convert content when user toggles between modes
- FR-6: Support CommonMark inline types: bold, italic, strikethrough, inline code, links
- FR-7: Support CommonMark block types: headers (h1-h6), fenced code blocks, blockquotes, horizontal rules, images
- FR-8: Support list types: ordered, unordered, and task lists
- FR-9: Map `~ship` syntax to/from `Ship` inline type for @mentions
- FR-10: Implement Tiptap input rules for on-the-fly Markdown conversion in rich text mode
- FR-11: Preserve header image and title independently of content mode
- FR-12: Handle conversion errors gracefully with user feedback
- FR-13: Ensure `handleSend` works correctly from either mode (content always saved as Story)

## Non-Goals

- No Markdown support in MessageInput (Chat) - BigInput only
- No GFM table support (complex layout, low priority)
- No live Markdown preview pane (split view)
- No syntax highlighting in Markdown editor (plain monospace only for MVP)
- No user preference to default to Markdown mode (session-only toggle for MVP)
- No Markdown export/download feature
- No support for HTML within Markdown

## Design Considerations

- Toggle button should use a recognizable Markdown icon (e.g., `M↓` or code brackets)
- Markdown editor should use a monospace font for readability
- Consider subtle background color difference to distinguish modes
- Mode indicator should be clear but not intrusive
- Reuse existing `InputToolbar` patterns for toggle placement

## Technical Considerations

- **Markdown Parser:** Evaluate `marked`, `remark`, or `markdown-it` for parsing. Prefer a parser that produces a traversable AST for clean Story mapping.
- **Tiptap Integration:** Tiptap has built-in Markdown extensions that may simplify FR-10 (on-the-fly conversion). Investigate `@tiptap/extension-typography` and input rules.
- **Round-trip Fidelity:** Some Story features may not have direct Markdown equivalents (e.g., `Cite`, `LinkBlock` with metadata). Define fallback representations.
- **WebView Boundary:** BigInput uses tentap-editor which runs Tiptap in a WebView. Markdown mode may need to communicate raw text differently than JSON content.
- **Existing Helpers:** Leverage `tiptap.JSONToInlines` and `toPostData` patterns from `content-helpers.ts`.

## Success Metrics

- Users can create and edit posts entirely in Markdown mode without data loss
- Round-trip conversion (Story → Markdown → Story) preserves all supported content types
- Mode toggle completes in under 500ms for typical post sizes
- No regressions in existing rich text editing functionality

## Open Questions

- Should the Markdown mode selection persist across sessions (user preference)?
- How should `Cite` blocks (references to other content) be represented in Markdown?
- Should `LinkBlock` (rich link previews) convert to simple `[title](url)` or a custom syntax?
- Is there demand for syntax highlighting in the Markdown editor (potential future enhancement)?
- Should on-the-fly Markdown conversion (FR-10) be opt-in or on by default?
