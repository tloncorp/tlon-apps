import { scry } from '@tloncorp/api';
import type { ChannelFromServer } from '@tloncorp/api/urbit';

import { commandError, errorMessage } from './commands/command';

// Discriminated so a joined channel always carries its group.
export type ChannelState =
  | { joined: false }
  | { joined: true; groupId: string; order: string[] };

// `/v5/channels` lists every channel in the local %channels state (joined
// channels only), each with its arranged order and its group, without posts.
export async function getChannelState(nest: string): Promise<ChannelState> {
  let channels: Record<string, ChannelFromServer> | null;
  try {
    channels = await scry<Record<string, ChannelFromServer>>({
      app: 'channels',
      path: '/v5/channels',
    });
  } catch (error) {
    throw commandError(errorMessage(error));
  }
  const channel = channels?.[nest];
  if (!channel) {
    return { joined: false };
  }
  return {
    joined: true,
    groupId: channel.perms.group,
    order: channel.order ?? [],
  };
}
