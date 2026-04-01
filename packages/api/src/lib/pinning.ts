export interface Pin {
  type: 'group' | 'channel' | 'dm' | 'groupDm';
  index: number;
  itemId: string;
}

export interface Channel {
  id: string;
  pin?: Pin | null;
}

export interface Group {
  id: string;
  pin?: Pin | null;
}

export interface PinToggleParams {
  chat: { type: 'channel' | 'group'; id: string } | null;
  channel?: Channel | null;
  group?: Group | null;
}

export interface PinToggleActions {
  unpinItem: (pin: Pin) => Promise<void>;
  pinChannel: (channel: Channel) => Promise<void>;
  pinGroup: (group: Group) => Promise<void>;
}

/**
 * Determines what pin action to take based on the current state.
 *
 * @param params - The parameters for the pin toggle.
 * @returns The action to take and the target to pin.
 */
export function whichPin(params: PinToggleParams): {
  action: 'unpin' | 'pin-channel' | 'pin-group' | 'none';
  target?: Pin | Channel | Group;
} {
  const { chat, channel, group } = params;

  if (chat?.type === 'channel' && channel) {
    if (channel.pin) {
      return { action: 'unpin', target: channel.pin };
    } else {
      return { action: 'pin-channel', target: channel };
    }
  } else if (chat?.type === 'group' && group) {
    if (group.pin) {
      return { action: 'unpin', target: group.pin };
    } else {
      return { action: 'pin-group', target: group };
    }
  }

  return { action: 'none' };
}

/**
 * Performs the pin action using the provided actions interface.
 *
 * @param res - The result of the whichPin function.
 * @param actions - The actions to execute.
 */
export async function doPin(
  res: ReturnType<typeof whichPin>,
  actions: PinToggleActions
): Promise<void> {
  switch (res.action) {
    case 'unpin':
      await actions.unpinItem(res.target as Pin);
      break;
    case 'pin-channel':
      await actions.pinChannel(res.target as Channel);
      break;
    case 'pin-group':
      await actions.pinGroup(res.target as Group);
      break;
    case 'none':
      // Do nothing
      break;
  }
}
