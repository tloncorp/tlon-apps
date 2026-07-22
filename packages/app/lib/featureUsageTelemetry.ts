import type {
  ChatListTelemetryEntity,
  HomeTelemetryFilter,
  NavigationTelemetryTab,
} from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';

import type { TabName } from '../hooks/useFilteredChats';

export function toHomeTelemetryFilter(tab: TabName): HomeTelemetryFilter {
  if (tab === 'groups' || tab === 'messages') {
    return tab;
  }
  return 'all';
}

export function getChatListTelemetryEntity(
  item: db.Chat
): ChatListTelemetryEntity {
  if (item.type === 'group') {
    return 'group';
  }
  if (item.channel.type === 'dm') {
    return 'direct_message';
  }
  if (item.channel.type === 'groupDm') {
    return 'group_message';
  }
  return 'channel';
}

export function getNavigationTelemetryTab(
  routeName: string
): NavigationTelemetryTab {
  if (routeName === 'ChatList') {
    return 'home';
  }
  if (routeName === 'Activity') {
    return 'activity';
  }
  if (routeName === 'Contacts') {
    return 'contacts';
  }
  return 'other';
}
