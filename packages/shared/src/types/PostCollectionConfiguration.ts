import { useMemo } from 'react';

import * as db from '../db';
import * as ChannelAction from './ChannelActions';

export interface PostCollectionConfiguration {
  shouldMaintainVisibleContentPosition: boolean;
  type: 'compact-list-bottom-to-top' | 'comfy-list-top-to-bottom' | 'grid';
  columnCount: 1 | 2;

  /** if true, enables day / unread dividers between elements */
  dividersEnabled: boolean;

  /** Width/height ratio for a collection element; e.g. 1 for square, 2 for
   * landscape, 0.5 for portrait. If null, defers to item sizing. */
  itemAspectRatio: number | null;

  /**
   * If true, in the absence of a given title, the channel will be titled in UI
   * with a comma-separated list of member names.
   */
  usesMemberListAsFallbackTitle: boolean;

  /**
   * If true, entering channel scrolls to the viewer's first unread post.
   */
  enableUnreadAnchor: boolean;

  postActionIds: ChannelAction.Id[];
}

// Why overload this function instead of just doing a union?
// If the caller has a non-nullable `channel`, they can then get a
// non-nullable return value - nice, right?
export function usePostCollectionConfigurationFromChannel(
  channel: db.Channel
): PostCollectionConfiguration;
export function usePostCollectionConfigurationFromChannel(
  channel: db.Channel | null
): PostCollectionConfiguration | null;
export function usePostCollectionConfigurationFromChannel(
  channel: db.Channel | null
): PostCollectionConfiguration | null {
  return useMemo(() => {
    switch (channel?.type) {
      case null:
      // fallthrough
      case undefined:
        return null;
      case 'chat':
      // fallthrough
      case 'dm':
      // fallthrough
      case 'groupDm':
        return {
          type: 'compact-list-bottom-to-top',
          shouldMaintainVisibleContentPosition: true,
          columnCount: 1,
          dividersEnabled: true,
          itemAspectRatio: null,
          postActionIds: ChannelAction.channelActionIdsFor({ channel }),
          usesMemberListAsFallbackTitle: channel.type !== 'chat',
          enableUnreadAnchor: true,
        };

      case 'notebook':
        return {
          type: 'comfy-list-top-to-bottom',
          shouldMaintainVisibleContentPosition: false,
          columnCount: 1,
          dividersEnabled: false,
          itemAspectRatio: null,
          postActionIds: ChannelAction.channelActionIdsFor({ channel }),
          usesMemberListAsFallbackTitle: false,
          enableUnreadAnchor: false,
        };

      case 'gallery':
        return {
          type: 'grid',
          shouldMaintainVisibleContentPosition: false,
          columnCount: 2,
          dividersEnabled: false,
          itemAspectRatio: 1,
          postActionIds: ChannelAction.channelActionIdsFor({ channel }),
          usesMemberListAsFallbackTitle: false,
          enableUnreadAnchor: false,
        };
    }
  }, [channel]);
}
