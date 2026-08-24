import crypto from 'node:crypto';

import { sharedMap } from './shared-state.js';

export type DeliveredNote = {
  noteId: number;
  title: string;
  deliveredAt: number;
};

const MAX_TRACKED_NOTEBOOKS = 64;
const deliveredNotes = sharedMap<string, DeliveredNote>(
  'notesDelivery.authoritativeNotes'
);

export function notesDeliveryMessageId(fromShip: string, noteId?: number) {
  return noteId === undefined
    ? `${fromShip}/notes-${crypto.randomUUID()}`
    : `${fromShip}/notes-${noteId}`;
}

export function noteIdFromDeliveryMessageId(messageId?: string) {
  const match = messageId?.match(/\/notes-(\d+)$/);
  if (!match) return undefined;
  const noteId = Number(match[1]);
  return Number.isSafeInteger(noteId) ? noteId : undefined;
}

export function recordDeliveredNote(
  notebookNest: string,
  note: { id: number; title: string },
  deliveredAt = Date.now()
) {
  deliveredNotes.delete(notebookNest);
  deliveredNotes.set(notebookNest, {
    noteId: note.id,
    title: note.title,
    deliveredAt,
  });
  while (deliveredNotes.size > MAX_TRACKED_NOTEBOOKS) {
    const oldest = deliveredNotes.keys().next().value;
    if (oldest === undefined) break;
    deliveredNotes.delete(oldest);
  }
}

export function takeDeliveredNote(
  notebookNest: string,
  options: { notBefore: number; noteId?: number }
): DeliveredNote | null {
  const delivered = deliveredNotes.get(notebookNest);
  if (
    delivered &&
    delivered.deliveredAt >= options.notBefore &&
    (options.noteId === undefined || delivered.noteId === options.noteId)
  ) {
    deliveredNotes.delete(notebookNest);
    return delivered;
  }
  if (options.noteId !== undefined) {
    return { noteId: options.noteId, title: '', deliveredAt: Date.now() };
  }
  return null;
}

export const notesDeliveryTesting = {
  clear: () => deliveredNotes.clear(),
};
