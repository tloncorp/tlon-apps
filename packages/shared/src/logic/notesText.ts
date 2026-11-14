import { PATP_REGEX } from '@tloncorp/api/client/utils';
import { shipToDisplayId } from '@tloncorp/api/lib/urbit';

import { formatChannelContentsSummary } from './channelContentsText';

const SHIP_NAMES = new RegExp(PATP_REGEX.source, 'gi');

/** The ship names in markdown, e.g. the people a note mentions. */
export function shipNamesIn(text: string): string[] {
  return [...text.matchAll(SHIP_NAMES)]
    .map((match) => match[0])
    .filter((ship) => shipToDisplayId(ship) !== null);
}

/**
 * Replace each ship name in markdown or a snippet of it with a mention's text:
 * a nickname when `mentionText` can resolve one, else the ship number.
 * Markdown keeps `~ship` on the wire; it's only shown this way.
 */
export function replaceShipNames(
  text: string,
  mentionText?: (ship: string) => string
): string {
  return text.replace(SHIP_NAMES, (ship) => {
    const displayId = shipToDisplayId(ship);
    if (!displayId) {
      return ship;
    }
    return mentionText?.(ship) ?? `@${displayId}`;
  });
}

/**
 * Flatten a note's markdown body into one line of readable prose: drop code
 * fences and images, keep link and inline-code text, and strip block and
 * emphasis markers. Used for note previews and search snippets, so both read
 * the same way.
 */
export function stripNoteMarkdown(
  bodyMd: string | null | undefined,
  mentionText?: (ship: string) => string
): string {
  return replaceShipNames(bodyMd ?? '', mentionText)
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
  bodyMd: string | null | undefined,
  mentionText?: (ship: string) => string
): string | null {
  return stripNoteMarkdown(bodyMd, mentionText) || null;
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
  return formatChannelContentsSummary({
    count: noteCount,
    noun: 'note',
    folderCount,
  });
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
