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

// `Channel`/`Group` above are the minimal shapes this module needs. Callers pass
// richer records (e.g. db.Channel) and their action callbacks expect that richer
// type back, so the concrete types are threaded through rather than widened —
// `whichPin` hands back the very object it was given.
export interface PinToggleParams<
  C extends Channel = Channel,
  G extends Group = Group,
> {
  chat: { type: 'channel' | 'group'; id: string } | null;
  channel?: C | null;
  group?: G | null;
}

export interface PinToggleActions<
  C extends Channel = Channel,
  G extends Group = Group,
> {
  unpinItem: (pin: Pin) => Promise<void>;
  pinChannel: (channel: C) => Promise<void>;
  pinGroup: (group: G) => Promise<void>;
}

export type PinResult<C extends Channel = Channel, G extends Group = Group> =
  | { action: 'unpin'; target: Pin }
  | { action: 'pin-channel'; target: C }
  | { action: 'pin-group'; target: G }
  | { action: 'none'; target?: undefined };

/**
 * Determines what pin action to take based on the current state.
 *
 * @param params - The parameters for the pin toggle.
 * @returns The action to take and the target to pin.
 */
export function whichPin<C extends Channel, G extends Group>(
  params: PinToggleParams<C, G>
): PinResult<C, G> {
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
export async function doPin<C extends Channel, G extends Group>(
  res: PinResult<C, G>,
  actions: PinToggleActions<C, G>
): Promise<void> {
  switch (res.action) {
    case 'unpin':
      await actions.unpinItem(res.target);
      break;
    case 'pin-channel':
      await actions.pinChannel(res.target);
      break;
    case 'pin-group':
      await actions.pinGroup(res.target);
      break;
    case 'none':
      // Do nothing
      break;
  }
}
