import {
  isDmChannelId,
  isGroupDmChannelId,
} from '@tloncorp/api/client/apiUtils';

import type { ProcessableNotificationData } from '../lib/notificationPayload';

export type NotificationRouteCategory =
  | 'dmInvite'
  | 'singleDm'
  | 'groupDm'
  | 'groupOrChannel'
  | 'nonChannelNotification';

export type MissingNotificationTargetRecovery =
  | 'none'
  | 'singleDmInvite'
  | 'dms'
  | 'groups';

export type NotificationTargetPreparation = {
  canNavigate: boolean;
  attemptedDmInviteRecovery: boolean;
};

export const defaultNotificationTargetPreparation: NotificationTargetPreparation =
  {
    canNavigate: true,
    attemptedDmInviteRecovery: false,
  };

export function getNotificationType(data: ProcessableNotificationData) {
  return data.type ?? 'channelNotification';
}

export function getNotificationRouteCategory(
  data: ProcessableNotificationData
): NotificationRouteCategory {
  if (!('channelId' in data)) {
    return 'nonChannelNotification';
  }

  if (data.type === 'dmInvite' && data.whomType === 'ship') {
    return 'dmInvite';
  }

  if (isDmChannelId(data.channelId)) {
    return 'singleDm';
  }

  if (isGroupDmChannelId(data.channelId)) {
    return 'groupDm';
  }

  return 'groupOrChannel';
}

export function getMissingNotificationTargetRecovery(
  data: ProcessableNotificationData,
  preparation: NotificationTargetPreparation = defaultNotificationTargetPreparation
): MissingNotificationTargetRecovery {
  if (!('channelId' in data)) {
    return 'none';
  }

  if (preparation.attemptedDmInviteRecovery) {
    return 'none';
  }

  if (isDmChannelId(data.channelId)) {
    return 'singleDmInvite';
  }

  if (isGroupDmChannelId(data.channelId)) {
    return 'dms';
  }

  return 'groups';
}
