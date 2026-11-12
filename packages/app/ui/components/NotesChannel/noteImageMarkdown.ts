export type NoteBodySelection = { start: number; end: number };

export function noteImageMarkdown(url: string) {
  return `![](${url})`;
}

/**
 * Replaces the selection with the given blocks, each its own paragraph, so a
 * standalone image renders as an image block rather than inline in the
 * surrounding text. Returns the new body and the caret after the insertion.
 */
export function insertNoteBodyBlocks(
  body: string,
  selection: NoteBodySelection,
  blocks: string[]
): { body: string; caret: number } {
  const start = Math.min(selection.start, selection.end, body.length);
  const end = Math.min(Math.max(selection.start, selection.end), body.length);
  const before = body.slice(0, start);
  const after = body.slice(end);
  const leading = before.length === 0 ? '' : paragraphBreak(before, 'end');
  const trailing = after.length === 0 ? '' : paragraphBreak(after, 'start');
  const inserted = leading + blocks.join('\n\n') + trailing;
  return {
    body: before + inserted + after,
    caret: before.length + inserted.length,
  };
}

/** The newlines that, added at `side` of `text`, leave a blank line there. */
function paragraphBreak(text: string, side: 'start' | 'end') {
  const match = side === 'end' ? /\n*$/.exec(text) : /^\n*/.exec(text);
  const existing = match?.[0].length ?? 0;
  return '\n'.repeat(Math.max(0, 2 - existing));
}
