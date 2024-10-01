import { useMemo } from 'react';
import { ViewStyle as TamaguiViewStyle } from 'tamagui';

import * as db from '../db';
import { ChannelAction, getPostActions } from '../types/messageActions';

export interface PostCollectionConfiguration {
  shouldMaintainVisibleContentPosition: boolean;
  contentContainerStyle: TamaguiViewStyle;
  columnCount: 1 | 2;

  /** if true, enables day / unread dividers between elements */
  dividersEnabled: boolean;

  /** Width/height ratio for a collection element; e.g. 1 for square, 2 for
   * landscape, 0.5 for portrait. If null, defers to item sizing. */
  itemAspectRatio: number | null;

  postActions: (options: {
    post: db.Post;
    isMuted?: boolean;
  }) => ChannelAction[];
}

export function usePostCollectionConfigurationFromChannelType(
  channelType: db.ChannelType
): PostCollectionConfiguration {
  return useMemo(() => {
    switch (channelType) {
      case 'chat':
      // fallthrough
      case 'dm':
      // fallthrough
      case 'groupDm':
        return {
          shouldMaintainVisibleContentPosition: true,
          contentContainerStyle: {
            paddingHorizontal: '$m',
          },
          columnCount: 1,
          dividersEnabled: true,
          itemAspectRatio: null,
          postActions: (options) => getPostActions({ ...options, channelType }),
        };

      case 'notebook':
        return {
          shouldMaintainVisibleContentPosition: false,
          contentContainerStyle: {
            paddingHorizontal: '$m',
            gap: '$l',
          },
          columnCount: 1,
          dividersEnabled: false,
          itemAspectRatio: null,
          postActions: (options) => getPostActions({ ...options, channelType }),
        };

      case 'gallery':
        return {
          shouldMaintainVisibleContentPosition: false,
          contentContainerStyle: {
            paddingHorizontal: '$l',
            gap: '$l',

            // We can't access safe area insets from this package :(
            // Special-case this at call-site.
            // paddingBottom: safeAreaInsets.bottom,
          },
          columnCount: 2,
          dividersEnabled: false,
          itemAspectRatio: 1,
          postActions: (options) => getPostActions({ ...options, channelType }),
        };
    }
  }, [channelType]);
}
