import crypto from 'node:crypto';

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
