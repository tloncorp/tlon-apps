import { createDevLogger } from '../lib/logger';
import { poke } from './urbit';

const logger = createDevLogger('notesApi', false);

// Notes channel ids are nests of the form `notes/<host>/<name>`.
function notesNestParts(
  channelId: string
): { host: string; name: string } | null {
  const [, host, name] = channelId.split('/');
  if (!host || !name) {
    return null;
  }
  return { host, name };
}

// Join a notes-backed channel by subscribing on %notes, which reports the join
// to %groups so it tracks our membership. (%channels' join would reject the
// unknown nest.) Errors propagate so the caller can roll back its optimistic
// update.
export const joinNotesChannel = async (channelId: string) => {
  const parts = notesNestParts(channelId);
  if (!parts) {
    return;
  }
  await poke({
    app: 'notes',
    mark: 'notes-action',
    json: { type: 'join', ship: parts.host, name: parts.name },
  });
};

// Leave a notes-backed channel via %notes (which unsubscribes and reports the
// leave to %groups) instead of %channels, which would reject the unknown nest.
export const leaveNotesChannel = async (channelId: string) => {
  const parts = notesNestParts(channelId);
  if (!parts) {
    return;
  }
  await poke({
    app: 'notes',
    mark: 'notes-action',
    json: { type: 'leave', ship: parts.host, name: parts.name },
  });
};

// Delete the underlying notebook on %notes after the group listing is removed,
// so we don't leak orphans. The agent rejects the delete unless we're the host,
// which is harmless — the listing is already gone from the group either way.
export const deleteNotesNotebook = async (channelId: string) => {
  const parts = notesNestParts(channelId);
  if (!parts) {
    return;
  }
  try {
    await poke({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'notebook',
        flag: `${parts.host}/${parts.name}`,
        action: { type: 'delete' },
      },
    });
  } catch (e) {
    logger.error('Failed to delete notebook in %notes', e);
  }
};
