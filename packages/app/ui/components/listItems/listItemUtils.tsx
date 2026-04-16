import type * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

export function useBoundHandler<T>(model: T, handler?: (model: T) => void) {
  return useCallback(() => {
    handler?.(model);
  }, [model, handler]);
}
export function getPostTypeIcon(type: db.Post['type']) {
  switch (type) {
    case 'chat':
      return 'ChannelTalk';
    case 'block':
      return 'ChannelGalleries';
    case 'note':
      return 'ChannelNotebooks';
    default:
      return 'Channel';
  }
}
export function getGroupStatus(group: db.Group) {
  const isPending = group.currentUserIsMember === false;
  const isErrored = group.joinStatus === 'errored';
  const isNew = group.currentUserIsMember && !!group.isNew;
  const isJoining = group.joinStatus === 'joining';
  const isRequested = group.haveRequestedInvite;
  const isInvite = group.haveInvite;

  const state = isJoining
    ? 'joining'
    : isErrored
      ? 'errored'
      : isNew
        ? 'new'
        : isRequested
          ? 'requested'
          : isInvite
            ? 'invited'
            : 'joined';

  const labels = {
    new: 'NEW',
    requested: 'Requested',
    invited: 'Invite',
    errored: 'Errored',
    joining: 'Joining',
    joined: '',
  };

  return {
    isPending,
    isErrored,
    isNew,
    isJoining,
    isRequested,
    isInvite,
    label: labels[state],
  };
}
