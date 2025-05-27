import * as db from '../db';
import * as store from '../store';

export interface PinToggleParams {
  chat: { type: 'channel' | 'group'; id: string } | null;
  channel?: db.Channel | null;
  group?: db.Group | null;
}

/**
 * Toggles the pin state of a chat (channel or group) while querying
 * the pin relation to ensure we have the current pin state.
 */
export async function togglePin(params: PinToggleParams): Promise<void> {
  const { chat, channel, group } = params;

  if (chat?.type === 'channel' && channel) {
    // Handle channel pinning (including DMs and group DMs)
    const channelWithPin = await db.getChannelWithRelations({ id: channel.id });
    if (!channelWithPin) {
      console.warn(`Channel ${channel.id} not found`);
      return;
    }

    if (channelWithPin.pin) {
      await store.unpinItem(channelWithPin.pin);
    } else {
      await store.pinChannel(channel);
    }
  } else if (chat?.type === 'group' && group) {
    // Handle group pinning
    const groupWithPin = await db.getGroup({ id: group.id });
    if (!groupWithPin) {
      console.warn(`Group ${group.id} not found`);
      return;
    }

    if (groupWithPin.pin) {
      await store.unpinItem(groupWithPin.pin);
    } else {
      await store.pinGroup(group);
    }
  }
}
