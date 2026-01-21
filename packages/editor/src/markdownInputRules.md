# Markdown Input Rules in the Editor

The Tiptap editor includes built-in Markdown shortcuts that automatically convert text as you type. These are provided by the tiptap extensions used in `MessageInputEditor.tsx`.

## Inline Marks

| Markdown Syntax | Result | Trigger |
|----------------|--------|---------|
| `**text**` | **bold** | Type closing `**` |
| `__text__` | **bold** | Type closing `__` |
| `*text*` | *italic* | Type closing `*` |
| `_text_` | *italic* | Type closing `_` |
| `` `text` `` | `code` | Type closing `` ` `` |
| `~~text~~` | ~~strikethrough~~ | Type closing `~~` |

## Block Elements

| Markdown Syntax | Result | Trigger |
|----------------|--------|---------|
| `# ` | Heading 1 | Type space after `#` at line start |
| `## ` | Heading 2 | Type space after `##` at line start |
| `### ` | Heading 3 | Type space after `###` at line start |
| `#### ` | Heading 4 | Type space after `####` at line start |
| `##### ` | Heading 5 | Type space after `#####` at line start |
| `###### ` | Heading 6 | Type space after `######` at line start |
| `- ` | Bullet list | Type space after `-` at line start |
| `* ` | Bullet list | Type space after `*` at line start |
| `+ ` | Bullet list | Type space after `+` at line start |
| `1. ` | Numbered list | Type space after number and `.` at line start |
| `> ` | Blockquote | Type space after `>` at line start |

## Code Blocks

Type ` ``` ` followed by Enter to create a fenced code block. You can optionally specify a language after the backticks (e.g., ` ```javascript `).

## Implementation

These input rules are provided by the following tiptap extensions used in `MessageInputEditor.tsx`:

- `BoldBridge` → `@tiptap/extension-bold`
- `ItalicBridge` → `@tiptap/extension-italic`
- `CodeBridge` → `@tiptap/extension-code`
- `StrikeBridge` → `@tiptap/extension-strike`
- `HeadingBridge` → `@tiptap/extension-heading`
- `BulletListBridge` → `@tiptap/extension-bullet-list`
- `OrderedListBridge` → `@tiptap/extension-ordered-list`
- `BlockquoteBridge` → `@tiptap/extension-blockquote`
- `CodeBlockBridge` → `@tiptap/extension-code-block`

The input rules are enabled by default in tiptap (via `enableInputRules: true` option).
