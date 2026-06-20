import { preSig } from '@tloncorp/api/lib/urbit';

export interface LensConversation {
  chatType: 'dm' | 'channel' | 'internal';
  conversationId: string | null;
}

/**
 * Pull the conversation coordinates out of a %steward lens entry payload
 * (`{ schemaVersion: 1, lens }`) without depending on the full lens type.
 */
export function extractLensConversation(
  payload: unknown
): LensConversation | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const record = payload as { schemaVersion?: unknown; lens?: unknown };
  if (record.schemaVersion !== 1 || !record.lens) {
    return null;
  }
  const lens = record.lens as {
    chatType?: unknown;
    triggerDetails?: { conversationId?: unknown };
  };
  if (
    lens.chatType !== 'dm' &&
    lens.chatType !== 'channel' &&
    lens.chatType !== 'internal'
  ) {
    return null;
  }
  const conversationId = lens.triggerDetails?.conversationId;
  return {
    chatType: lens.chatType,
    conversationId: typeof conversationId === 'string' ? conversationId : null,
  };
}

function isDmChannelId(channelId: string) {
  return channelId.startsWith('~') && !channelId.includes('/');
}

/**
 * Whether a synced lens run belongs to the given channel. DM channel ids are
 * the counterpart ship, so a bot's dm-triggered runs match its DM channel;
 * group-channel runs match on the trigger's channel nest.
 */
export function lensRunMatchesChannel(
  run: { botShip: string; payload: unknown },
  channelId: string
): boolean {
  const conversation = extractLensConversation(run.payload);
  if (!conversation || conversation.chatType === 'internal') {
    return false;
  }
  if (isDmChannelId(channelId)) {
    return (
      conversation.chatType === 'dm' &&
      preSig(run.botShip) === preSig(channelId)
    );
  }
  return (
    conversation.chatType === 'channel' &&
    conversation.conversationId === channelId
  );
}
