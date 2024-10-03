import * as db from '../db';

export interface ChannelAction {
  id: string;
  label: string;
  actionType?: 'destructive';
  networkDependent: boolean;
}

// a very "UI"-focused function to include in `shared`, no?
// well, think about it this way:
// we're using this to configure the actions for the default channels:
// a shared set of primitives for all Tlon software.
// are you getting it?
export function getPostActions({
  post,
  channelType,
  isMuted,
}: {
  post: db.Post;
  channelType: db.ChannelType;
  isMuted?: boolean;
}): ChannelAction[] {
  switch (channelType) {
    case 'gallery':
      return [
        { id: 'startThread', label: 'Comment on post', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        { id: 'copyRef', label: 'Copy link to post', networkDependent: false },
        { id: 'edit', label: 'Edit post', networkDependent: true },
        { id: 'report', label: 'Report post', networkDependent: true },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
    case 'notebook':
      return [
        { id: 'startThread', label: 'Comment on post', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        { id: 'copyRef', label: 'Copy link to post', networkDependent: false },
        { id: 'edit', label: 'Edit post', networkDependent: true },
        { id: 'report', label: 'Report post', networkDependent: true },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
    case 'dm':
    case 'groupDm':
      return [
        // { id: 'quote', label: 'Quote' },
        { id: 'startThread', label: 'Start thread', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        {
          id: 'viewReactions',
          label: 'View reactions',
          networkDependent: false,
        },
        { id: 'copyText', label: 'Copy message text', networkDependent: false },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
    case 'chat':
    default:
      return [
        { id: 'quote', label: 'Quote', networkDependent: true },
        { id: 'startThread', label: 'Start thread', networkDependent: true },
        {
          id: 'muteThread',
          label: isMuted ? 'Unmute thread' : 'Mute thread',
          networkDependent: true,
        },
        {
          id: 'viewReactions',
          label: 'View reactions',
          networkDependent: false,
        },
        {
          id: 'copyRef',
          label: 'Copy link to message',
          networkDependent: false,
        },
        { id: 'copyText', label: 'Copy message text', networkDependent: false },
        { id: 'edit', label: 'Edit message', networkDependent: true },
        {
          id: 'visibility',
          label: post?.hidden ? 'Show post' : 'Hide post',
          networkDependent: true,
        },
        { id: 'report', label: 'Report message', networkDependent: true },
        {
          id: 'delete',
          label: 'Delete message',
          actionType: 'destructive',
          networkDependent: true,
        },
      ];
  }
}
