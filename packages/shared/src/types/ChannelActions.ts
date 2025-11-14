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
  | 'forward'
  | 'summarize';

/**
 * Info about a channel action type that should not change based on context.
 */
export interface StaticSpec {
  actionType?: 'destructive';
  isNetworkDependent: boolean;
}

export function channelActionIdsFor({
  channel,
  canWrite,
}: {
  channel: db.Channel;
  canWrite?: boolean;
}): Id[] {
  const channelType = channel?.type;
  let actions: Id[] = [];

  switch (channelType) {
    case undefined:
      return [];
    case 'gallery':
      actions = [
        'startThread',
        'muteThread',
        'copyRef',
        'forward',
        'edit',
        'report',
        'visibility',
        'delete',
        'summarize',
      ];
      break;
    case 'notebook':
      actions = [
        'startThread',
        'muteThread',
        'copyRef',
        'forward',
        'edit',
        'report',
        'visibility',
        'delete',
        'summarize',
      ];
      break;
    case 'dm':
    case 'groupDm':
      actions = [
        'quote',
        'startThread',
        'muteThread',
        'viewReactions',
        'copyText',
        'visibility',
        'delete',
        'summarize',
      ];
      break;
    case 'chat':
      actions = [
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
        'summarize',
      ];
      if (__DEV__) {
        actions.unshift('debugJson');
      }
      break;
  }

  // Filter out write-dependent actions if user cannot write
  if (canWrite === false) {
    const writeOnlyActions: Id[] = ['quote', 'startThread', 'edit'];
    actions = actions.filter((action) => !writeOnlyActions.includes(action));
  }

  return actions;
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
  summarize: { isNetworkDependent: true },
} satisfies Record<Id, StaticSpec>;
