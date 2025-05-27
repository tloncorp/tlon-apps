import * as db from '../db';
import * as store from '../store';

export interface PinToggleParams {
  chat: { type: 'channel' | 'group'; id: string } | null;
  channel?: db.Channel | null;
  group?: db.Group | null;
}

/**
 * Toggles the pin state of a chat (channel or group)
 */
export async function togglePin(params: PinToggleParams): Promise<void> {
  const { chat, channel, group } = params;

  if (chat?.type === 'channel' && channel) {
    // Handle channel pinning (including DMs and group DMs)
    if (channel.pin) {
      await store.unpinItem(channel.pin);
    } else {
      await store.pinChannel(channel);
    }
  } else if (chat?.type === 'group' && group && group.channels?.[0]) {
    // Handle group pinning
    if (group.pin) {
      await store.unpinItem(group.pin);
    } else {
      await store.pinGroup(group);
    }
  }
  // If none of the conditions match, do nothing
}
