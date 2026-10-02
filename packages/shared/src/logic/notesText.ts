/**
 * Flatten a note's markdown body into one line of readable prose: drop code
 * fences and images, keep link and inline-code text, and strip block and
 * emphasis markers. Used for note previews and search snippets, so both read
 * the same way.
 */
export function stripNoteMarkdown(bodyMd: string | null | undefined): string {
  return (bodyMd ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[\s>*+-]*\[[ x]\]\s+/gim, '')
    .replace(/^[\s>*+-]+/gm, '')
    .replace(/[*_~#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The flattened body for a note row, or null when there's nothing to show. */
export function getNoteBodyPreview(
  bodyMd: string | null | undefined
): string | null {
  return stripNoteMarkdown(bodyMd) || null;
}

/**
 * One-line summary of what a notebook holds, for rows that have no post to
 * preview (e.g. a notes channel in the group channel list). Folder counts
 * are expected to exclude the notebook's root folder.
 */
export function formatNotesChannelSubtitle({
  noteCount,
  folderCount,
}: {
  noteCount: number;
  folderCount: number;
}): string {
  const notes = noteCount === 0 ? 'No notes' : countOf(noteCount, 'note');
  return folderCount === 0
    ? notes
    : `${notes} in ${countOf(folderCount, 'folder')}`;
}

function countOf(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Format the status line for notebook activity shown on a group row. */
export function formatNotesActivityLabel({
  noteTitle,
  notebookTitle,
  isNew,
}: {
  noteTitle: string | null | undefined;
  notebookTitle: string | null | undefined;
  isNew: boolean;
}): string {
  const title = noteTitle?.trim();
  const notebook = notebookTitle?.trim();
  const quotedTitle = title ? ` “${title}”` : '';
  const location = notebook ? ` in ${notebook}` : '';

  return isNew
    ? `New note${quotedTitle}${location}`
    : `Note${quotedTitle} edited${location}`;
}
