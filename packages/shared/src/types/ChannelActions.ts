import * as db from '../db';

export type Id =
  | 'debugJson'
  | 'quote'
  | 'startThread'
  | 'muteThread'
  | 'viewReactions'
  | 'copyRef'
  | 'copyText'
  | 'edit'
  | 'report'
  | 'visibility'
  | 'delete'
  | 'forward';

/**
 * Info about a channel action type that should not change based on context.
 */
export interface StaticSpec {
  actionType?: 'destructive';
  isNetworkDependent: boolean;
}

export function channelActionIdsFor({
  channel,
}: {
  channel: db.Channel;
}): Id[] {
  const channelType = channel?.type;
  switch (channelType) {
    case undefined:
      return [];
    case 'gallery':
      return [
        'startThread',
        'muteThread',
        'copyRef',
        'forward',
        'edit',
        'report',
        'visibility',
        'delete',
      ];
    case 'notebook':
      return [
        'startThread',
        'muteThread',
        'copyRef',
        'forward',
        'edit',
        'report',
        'visibility',
        'delete',
      ];
    case 'dm':
    case 'groupDm':
      return [
        'quote',
        'startThread',
        'muteThread',
        'viewReactions',
        'copyText',
        'visibility',
        'delete',
      ];
    case 'chat':
      return [
        'debugJson',
        'quote',
        'startThread',
        'muteThread',
        'viewReactions',
        'copyRef',
        'forward',
        'copyText',
        'edit',
        'visibility',
        'report',
        'delete',
      ];
  }
}
export function staticSpecForId(id: Id): StaticSpec {
  return STATIC_SPECS[id];
}

const STATIC_SPECS = {
  copyRef: { isNetworkDependent: false },
  copyText: { isNetworkDependent: false },
  delete: { isNetworkDependent: true, actionType: 'destructive' },
  edit: { isNetworkDependent: true },
  muteThread: { isNetworkDependent: true },
  quote: { isNetworkDependent: true },
  forward: { isNetworkDependent: true },
  report: { isNetworkDependent: true },
  startThread: { isNetworkDependent: true },
  viewReactions: { isNetworkDependent: false },
  visibility: { isNetworkDependent: true },
  debugJson: { isNetworkDependent: false },
} satisfies Record<Id, StaticSpec>;
