import * as db from '../db';
import * as ChannelAction from './ChannelActions';

/**
 * How do we want to lay out a collection of posts, at a high level?
 */
export type PostCollectionLayoutType =
  | 'comfy-list-top-to-bottom' // think: notebook
  | 'compact-list-bottom-to-top' // think: chat
  | 'grid'; // think: gallery

// Why overload this function instead of just doing a union?
// If the caller has a non-nullable `channel`, they can then get a
// non-nullable return value - nice, right?
export function postCollectionLayoutTypeFromChannel(
  channel: db.Channel
): PostCollectionLayoutType;
export function postCollectionLayoutTypeFromChannel(
  channel: db.Channel | null
): PostCollectionLayoutType | null;
export function postCollectionLayoutTypeFromChannel(
  channel: db.Channel | null
): PostCollectionLayoutType | null {
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
      return 'compact-list-bottom-to-top';

    case 'notebook':
      return 'comfy-list-top-to-bottom';

    case 'gallery':
      return 'grid';
  }
}

/**
 * Features of a given `PostCollectionLayoutType` - these should be constant
 * w.r.t. the layout type (i.e. not change based on whether the channel is a DM
 * vs chat).
 * If you need to branch based on the channel type, try using
 * `PostCollectionConfiguration` instead.
 */
export interface PostCollectionLayout {
  columnCount: 1 | 2;

  /** if true, enables day / unread dividers between elements */
  dividersEnabled: boolean;

  /**
   * If true, entering channel scrolls to the viewer's first unread post.
   */
  enableUnreadAnchor: boolean;

  /**
   * Width/height ratio for a collection element; e.g. 1 for square, 2 for
   * landscape, 0.5 for portrait. If null, defers to item sizing.
   */
  itemAspectRatio: number | null;

  /**
   * When new content comes in, should we try to keep the user's scroll position?
   */
  shouldMaintainVisibleContentPosition: boolean;
}

export function postCollectionLayoutForType(
  layoutType: PostCollectionLayoutType
): PostCollectionLayout {
  switch (layoutType) {
    case 'compact-list-bottom-to-top':
      return {
        columnCount: 1,
        dividersEnabled: true,
        enableUnreadAnchor: true,
        itemAspectRatio: null,
        shouldMaintainVisibleContentPosition: true,
      };

    case 'comfy-list-top-to-bottom':
      return {
        columnCount: 1,
        dividersEnabled: false,
        enableUnreadAnchor: false,
        itemAspectRatio: null,
        shouldMaintainVisibleContentPosition: false,
      };

    case 'grid':
      return {
        columnCount: 2,
        dividersEnabled: false,
        enableUnreadAnchor: false,
        itemAspectRatio: 1,
        shouldMaintainVisibleContentPosition: false,
      };
  }
}

/**
 * Configuration for a post collection which may depend on the channel type or
 * other runtime factors.
 */
export interface PostCollectionConfiguration {
  /**
   * What actions should we show in the post context menu?
   */
  postActionIds: ChannelAction.Id[];

  /**
   * If true, in the absence of a given title, the channel will be titled in UI
   * with a comma-separated list of member names.
   */
  usesMemberListAsFallbackTitle: boolean;
}

export function postCollectionConfigurationFromChannel(
  channel: db.Channel
): PostCollectionConfiguration;
export function postCollectionConfigurationFromChannel(
  channel: db.Channel | null
): PostCollectionConfiguration | null;
export function postCollectionConfigurationFromChannel(
  channel: db.Channel | null
): PostCollectionConfiguration | null {
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
        postActionIds: ChannelAction.channelActionIdsFor({ channel }),
        usesMemberListAsFallbackTitle: channel.type !== 'chat',
      };

    case 'notebook':
      return {
        postActionIds: ChannelAction.channelActionIdsFor({ channel }),
        usesMemberListAsFallbackTitle: false,
      };

    case 'gallery':
      return {
        postActionIds: ChannelAction.channelActionIdsFor({ channel }),
        usesMemberListAsFallbackTitle: false,
      };
  }
}
