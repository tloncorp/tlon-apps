import { isEqual, omit } from 'lodash';

import {
  getDesktopChannelRoute,
  getDesktopGroupRoute,
  getDesktopPostRoute,
  screenNameFromChannelId,
} from './routeHelpers';
import { getTopLevelTabRoute } from './topLevelTabs';
import type { SettingsDrawerParamList } from './types';

/** Narrowest window, in points, that gets the split list and detail layout. */
export const SPLIT_LAYOUT_MIN_WIDTH = 768;

export function isSplitLayoutWidth(width: number) {
  return width >= SPLIT_LAYOUT_MIN_WIDTH;
}

export type NativeLayout = 'phone' | 'split';

/**
 * Settings screens both trees register under the same name: the phone root
 * stack and the split layout's settings drawer.
 */
const SETTINGS_DETAIL_SCREENS: ReadonlySet<string> = new Set<
  keyof SettingsDrawerParamList
>([
  'ManageAccount',
  'BotSettings',
  'BotMcpSettings',
  'BotModelSettings',
  'BotApiKeySettings',
  'BotOpenAISubscription',
  'BotShipListSettings',
  'BotChannelRulesSettings',
  'BotChannelRuleSettings',
  'BotPermissionsSettings',
  'BotIdentitySettings',
  'BotProviderListSettings',
  'BlockedUsers',
  'Theme',
  'AppInfo',
  'FeatureFlags',
  'PushNotificationSettings',
  'WompWomp',
  'PrivacySettings',
]);

/**
 * The split layout lists conversations under Home and, for DMs, under
 * Messages. The phone tree has one chat list, so it carries the section of an
 * open DM as a param on its tab route for the split tree to read back.
 */
type SplitSection = 'Messages';
const SPLIT_SECTION_PARAM = 'splitSection';

/**
 * Where the user is, independent of which navigator tree shows it. The phone
 * tree (RootStack) and the split tree (TopLevelDrawer) name the same places
 * differently, so switching trees goes through this.
 */
export type LayoutPosition =
  | { kind: 'home'; section?: SplitSection }
  | { kind: 'activity' }
  | { kind: 'inviteSystemContacts' }
  | { kind: 'settings' }
  | { kind: 'settingsScreen'; screen: string; params?: object }
  | { kind: 'contacts' }
  | { kind: 'profile'; userId: string }
  | { kind: 'editProfile'; userId: string }
  | {
      kind: 'chatDetails';
      screen: 'ChatDetails' | 'ChatVolume';
      chatType: 'group' | 'channel';
      chatId: string;
      groupId?: string;
      section?: SplitSection;
    }
  | { kind: 'group'; groupId: string }
  | {
      kind: 'groupSettings';
      groupId: string;
      channelId?: string;
      screen: string;
      params: object;
    }
  | {
      kind: 'channel';
      channelId: string;
      groupId?: string;
      section?: SplitSection;
    }
  | {
      kind: 'post';
      channelId: string;
      groupId?: string;
      postId: string;
      authorId: string;
      section?: SplitSection;
    };

type RouteLike = {
  name: string;
  params?: object;
  state?: StateLike;
};

type ResetRoute = { name: string; params?: object };

type StateLike = {
  type?: string;
  index?: number;
  routes: readonly RouteLike[];
};

function stringParam(params: object | undefined, key: string) {
  const value = (params as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// A route reached through `navigate(parent, { screen, params })` or
// `navigate(parent, { state })` has no state of its own until its navigator
// mounts; its child is described by its params.
function childFromParams(route: RouteLike): RouteLike | undefined {
  const paramState = (route.params as { state?: StateLike } | undefined)?.state;
  if (paramState?.routes?.length) {
    return paramState.routes[paramState.index ?? paramState.routes.length - 1];
  }
  const screen = stringParam(route.params, 'screen');
  if (!screen) {
    return undefined;
  }
  const params = (route.params as { params?: object }).params;
  return { name: screen, params };
}

function focusedChild(route: RouteLike): RouteLike | undefined {
  if (route.state) {
    const { routes, index } = route.state;
    return routes[index ?? routes.length - 1];
  }
  return childFromParams(route);
}

function isDmChannel(channelId: string) {
  return screenNameFromChannelId(channelId) !== 'Channel';
}

function withSection(
  position: LayoutPosition,
  section: SplitSection
): LayoutPosition {
  switch (position.kind) {
    case 'home':
      return { ...position, section };
    case 'channel':
    case 'post':
      return isDmChannel(position.channelId)
        ? { ...position, section }
        : position;
    case 'chatDetails':
      return { ...position, section };
    default:
      return position;
  }
}

// Group settings in the split tree live in a channel's stack; carry that
// channel so the other tree can open them from the same place.
function withChannelContext(
  position: LayoutPosition,
  context: LayoutPosition | null
): LayoutPosition {
  if (
    position.kind === 'groupSettings' &&
    !position.channelId &&
    context?.kind === 'channel' &&
    context.groupId === position.groupId
  ) {
    return { ...position, channelId: context.channelId };
  }
  return position;
}

function positionFromRoute(route: RouteLike): LayoutPosition | null {
  const channelId = stringParam(route.params, 'channelId');
  const groupId = stringParam(route.params, 'groupId');
  if (SETTINGS_DETAIL_SCREENS.has(route.name)) {
    return route.params
      ? { kind: 'settingsScreen', screen: route.name, params: route.params }
      : { kind: 'settingsScreen', screen: route.name };
  }
  switch (route.name) {
    case 'Post': {
      const postId = stringParam(route.params, 'postId');
      const authorId = stringParam(route.params, 'authorId');
      if (channelId && postId && authorId) {
        return { kind: 'post', channelId, groupId, postId, authorId };
      }
      return null;
    }
    case 'Channel':
    case 'DM':
    case 'GroupDM':
    case 'ChannelRoot':
    case 'BotChat':
      return channelId ? { kind: 'channel', channelId, groupId } : null;
    case 'GroupChannels':
      return groupId ? { kind: 'group', groupId } : null;
    case 'GroupSettings': {
      const child = focusedChild(route);
      const settingsGroupId = stringParam(child?.params, 'groupId');
      return child?.params && settingsGroupId
        ? {
            kind: 'groupSettings',
            groupId: settingsGroupId,
            screen: child.name,
            params: child.params,
          }
        : null;
    }
    case 'UserProfile': {
      const userId = stringParam(route.params, 'userId');
      return userId ? { kind: 'profile', userId } : null;
    }
    case 'EditProfile': {
      const userId = stringParam(route.params, 'userId');
      return userId ? { kind: 'editProfile', userId } : null;
    }
    case 'ChatDetails':
    case 'ChatVolume': {
      const chatId = stringParam(route.params, 'chatId');
      const chatType = stringParam(route.params, 'chatType');
      return chatId && (chatType === 'group' || chatType === 'channel')
        ? { kind: 'chatDetails', screen: route.name, chatType, chatId, groupId }
        : null;
    }
    case 'Activity':
      return { kind: 'activity' };
    case 'InviteSystemContacts':
      return { kind: 'inviteSystemContacts' };
    case 'Settings':
      return { kind: 'settings' };
    case 'Contacts':
      return { kind: 'contacts' };
    case 'MainTabs':
    case 'ChatList':
    case 'Home':
      return { kind: 'home' };
    case 'Messages':
      return { kind: 'home', section: 'Messages' };
    default:
      return null;
  }
}

function positionFromRouteTree(route: RouteLike): LayoutPosition | null {
  // Group settings are one position, not a route tree to descend into.
  if (route.name === 'GroupSettings') {
    return positionFromRoute(route);
  }
  const child = route.state
    ? positionFromState(route.state)
    : (() => {
        const nested = childFromParams(route);
        return nested ? positionFromRouteTree(nested) : null;
      })();
  if (!child) {
    return positionFromRoute(route);
  }
  if (route.name === 'Messages') {
    return withSection(child, 'Messages');
  }
  return withChannelContext(child, positionFromRoute(route));
}

function positionFromState(state: StateLike): LayoutPosition | null {
  const focusedIndex = state.index ?? state.routes.length - 1;
  // In a stack, a screen this does not recognize (channel members, a media
  // viewer) sits on top of the place it was opened from, so fall back to the
  // routes beneath it. Tabs and drawers hold siblings, not history.
  const lowestIndex = state.type === 'stack' ? 0 : focusedIndex;
  for (let i = focusedIndex; i >= lowestIndex; i--) {
    const route = state.routes[i];
    const position = route ? positionFromRouteTree(route) : null;
    if (position?.kind === 'groupSettings' && i > lowestIndex) {
      return withChannelContext(position, positionFromStateBelow(state, i));
    }
    if (position) {
      return position;
    }
  }
  return null;
}

function positionFromStateBelow(state: StateLike, index: number) {
  return positionFromState({
    ...state,
    index: index - 1,
    routes: state.routes.slice(0, index),
  });
}

function phoneSplitSection(state: StateLike): SplitSection | undefined {
  const root = state.routes[0];
  if (root?.name !== 'MainTabs') {
    return undefined;
  }
  const section = stringParam(root.params, SPLIT_SECTION_PARAM);
  return section === 'Messages' ? section : undefined;
}

export function getLayoutPosition(
  state: StateLike | undefined
): LayoutPosition | null {
  if (!state) {
    return null;
  }
  const position = positionFromState(state);
  const section = phoneSplitSection(state);
  // The param stays on the tab route while the user moves around the phone
  // tree, so it only places conversations, which the Messages sidebar lists.
  return position &&
    section &&
    (position.kind === 'channel' ||
      position.kind === 'post' ||
      position.kind === 'chatDetails')
    ? withSection(position, section)
    : position;
}

function phoneRoutes(position: LayoutPosition): ResetRoute[] {
  const section =
    'section' in position && position.section
      ? { [SPLIT_SECTION_PARAM]: position.section }
      : {};
  const chatList = getTopLevelTabRoute('ChatList');
  const tabs = { ...chatList, params: { ...chatList.params, ...section } };
  switch (position.kind) {
    case 'home':
      // Without a named tab the phone tree opens its default one, which is
      // the bot chat when the account has one.
      return [{ name: 'MainTabs' }];
    case 'activity':
      return [getTopLevelTabRoute('Activity')];
    case 'inviteSystemContacts':
      return [
        getTopLevelTabRoute('Activity'),
        { name: 'InviteSystemContacts' },
      ];
    case 'settings':
      return [getTopLevelTabRoute('Settings')];
    case 'settingsScreen':
      return [
        getTopLevelTabRoute('Settings'),
        position.params
          ? { name: position.screen, params: position.params }
          : { name: position.screen },
      ];
    case 'contacts':
      return [chatList, { name: 'Contacts' }];
    case 'profile':
      return [
        chatList,
        { name: 'UserProfile', params: { userId: position.userId } },
      ];
    case 'editProfile':
      return [
        chatList,
        { name: 'UserProfile', params: { userId: position.userId } },
        { name: 'EditProfile', params: { userId: position.userId } },
      ];
    case 'chatDetails': {
      const { chatType, chatId, groupId } = position;
      return [
        tabs,
        chatType === 'group'
          ? { name: 'GroupChannels', params: { groupId: chatId } }
          : {
              name: screenNameFromChannelId(chatId),
              params: { channelId: chatId, ...(groupId ? { groupId } : {}) },
            },
        { name: position.screen, params: { chatType, chatId, groupId } },
      ];
    }
    case 'group':
      return [
        chatList,
        { name: 'GroupChannels', params: { groupId: position.groupId } },
      ];
    case 'groupSettings':
      return [
        chatList,
        ...(position.channelId
          ? [
              {
                name: screenNameFromChannelId(position.channelId),
                params: {
                  channelId: position.channelId,
                  groupId: position.groupId,
                },
              },
            ]
          : []),
        {
          name: 'GroupSettings',
          params: { screen: position.screen, params: position.params },
        },
      ];
    case 'channel':
    case 'post': {
      const groupParams = position.groupId ? { groupId: position.groupId } : {};
      const channel = {
        name: screenNameFromChannelId(position.channelId),
        params: { channelId: position.channelId, ...groupParams },
      };
      if (position.kind === 'channel') {
        return [tabs, channel];
      }
      return [
        tabs,
        channel,
        {
          name: 'Post',
          params: {
            postId: position.postId,
            authorId: position.authorId,
            channelId: position.channelId,
            ...groupParams,
          },
        },
      ];
    }
  }
}

function splitRoutes(position: LayoutPosition): ResetRoute[] {
  switch (position.kind) {
    case 'home':
      return [{ name: position.section ?? 'Home' }];
    case 'activity':
      return [{ name: 'Activity' }];
    case 'inviteSystemContacts':
      return [{ name: 'Activity', params: { screen: 'InviteSystemContacts' } }];
    case 'settings':
      return [{ name: 'Settings' }];
    case 'settingsScreen':
      return [
        {
          name: 'Settings',
          params: position.params
            ? { screen: position.screen, params: position.params }
            : { screen: position.screen },
        },
      ];
    case 'contacts':
      return [{ name: 'Contacts' }];
    case 'profile':
      return [
        {
          name: 'Contacts',
          params: {
            screen: 'UserProfile',
            params: { userId: position.userId },
          },
        },
      ];
    case 'editProfile':
      return [
        {
          name: 'Contacts',
          params: {
            screen: 'EditProfile',
            params: { userId: position.userId },
          },
        },
      ];
    case 'chatDetails':
      return [
        {
          name: position.section ?? 'Home',
          params: {
            screen: position.screen,
            params: {
              chatType: position.chatType,
              chatId: position.chatId,
              groupId: position.groupId,
            },
          },
        },
      ];
    case 'group':
      return [getDesktopGroupRoute(position.groupId)];
    case 'groupSettings': {
      const groupSettings = {
        screen: 'GroupSettings',
        params: { screen: position.screen, params: position.params },
      };
      if (!position.channelId) {
        // The activity drawer is the split tree's only host for group
        // settings outside a channel.
        return [{ name: 'Activity', params: groupSettings }];
      }
      return [
        {
          name: 'Home',
          params: {
            screen: screenNameFromChannelId(position.channelId),
            pop: true,
            params: {
              channelId: position.channelId,
              groupId: position.groupId,
              ...groupSettings,
            },
          },
        },
      ];
    }
    case 'channel':
      return [
        getDesktopChannelRoute(
          position.section ?? 'Home',
          position.channelId,
          position.groupId
        ),
      ];
    case 'post':
      return [
        getDesktopPostRoute(position.section ?? 'Home', {
          postId: position.postId,
          authorId: position.authorId,
          channelId: position.channelId,
          groupId: position.groupId,
        }),
      ];
  }
}

/** A root reset that shows `position` in the given layout's navigator tree. */
export function getLayoutState(position: LayoutPosition, layout: NativeLayout) {
  const routes =
    layout === 'phone' ? phoneRoutes(position) : splitRoutes(position);
  return { index: routes.length - 1, routes };
}

/**
 * Whether two positions name the same place. The split section is ignored:
 * only the split tree can show it, so a position read from the phone tree may
 * lack it.
 */
export function isSamePlace(a: LayoutPosition, b: LayoutPosition) {
  const normalize = (position: LayoutPosition) =>
    JSON.parse(JSON.stringify(omit(position, 'section')));
  return isEqual(normalize(a), normalize(b));
}
