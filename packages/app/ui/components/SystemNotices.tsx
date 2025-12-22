import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import { XStack, YStack, isWeb, styled } from 'tamagui';

import { useContactPermissions } from '../../hooks/useContactPermissions';
import { useNag } from '../../hooks/useNag';
import { useNotificationPermissions } from '../../lib/notifications';
import { useStore } from '../contexts';

const logger = createDevLogger('SystemNotices', false);

const NoticeFrame = styled(YStack, {
  backgroundColor: '$systemNoticeBackground',
  padding: '$2xl',
  marginHorizontal: '$l',
  borderRadius: '$l',
});

const NoticeBody = styled(Text, {
  color: '$systemNoticeText',
  opacity: 0.7,
  size: '$label/l',
});

const NoticeTitle = styled(Text, {
  color: '$systemNoticeText',
  size: '$label/xl',
  fontWeight: '600',
});

const SystemNotices = {
  ContactBookPrompt,
  NotificationsPrompt,
  JoinRequestNotice,
  ConnectedJoinRequestNotice,
  NonHostAdminChannelNotice,
  NoticeFrame,
  NoticeBody,
  NoticeTitle,
};

export default SystemNotices;

export function NotificationsPrompt() {
  const notifNag = useNag({
    key: 'notificationsPrompt',
    refreshInterval: 30 * 60 * 1000, // Nag every 30 minutes
    refreshCycle: 5, // Repeat 5 times
    initialDelay: 10 * 1000, // Fire after 10s the first time
  });

  const perms = useNotificationPermissions();
  const openedSettingsRef = useRef(false);

  useEffect(() => {
    if (openedSettingsRef.current && perms.hasPermission) {
      logger.trackEvent(AnalyticsEvent.ActionNotifPermsGrantedFromNag);
      notifNag.eliminate();
      openedSettingsRef.current = false;
    }
  }, [perms.hasPermission, notifNag]);

  const handleDismiss = useCallback(() => {
    notifNag.dismiss();
  }, [notifNag]);

  const handlePrimaryAction = useCallback(async () => {
    if (perms.canAskPermission) {
      await perms.requestPermissions();
      if (perms.hasPermission) {
        Alert.alert('Success', 'You will now receive notifications.');
        notifNag.eliminate();
      } else {
        notifNag.dismiss();
      }
    } else {
      logger.trackEvent(AnalyticsEvent.ActionNotifPermsSettingsOpened);
      openedSettingsRef.current = true;
      perms.openSettings();
    }
  }, [perms, notifNag]);

  if (
    isWeb ||
    !perms.initialized ||
    perms.hasPermission ||
    perms.canAskPermission ||
    notifNag.isLoading ||
    !notifNag.shouldShow
  ) {
    return null;
  }

  return (
    <NoticeFrame>
      <YStack gap="$5xl">
        <YStack gap="$xl">
          <NoticeTitle>Enable notifications</NoticeTitle>
          <NoticeBody>
            Tlon Messenger works best if you enable push notifications on your
            device.
          </NoticeBody>
        </YStack>
        <XStack gap="$m" justifyContent="flex-end">
          <Button
            padding="$xl"
            paddingHorizontal="$2xl"
            backgroundColor="$systemNoticeBackground"
            borderColor="$positiveBorder"
            borderWidth={1.6}
            pressStyle={{
              opacity: 0.7,
              backgroundColor: '$systemNoticeBackground',
            }}
            onPress={handleDismiss}
          >
            <Button.Text color="$systemNoticeText" fontWeight="500">
              Not Now
            </Button.Text>
          </Button>
          <Button
            backgroundColor="$systemNoticeText"
            padding="$xl"
            paddingHorizontal="$2xl"
            borderWidth={0}
            pressStyle={{
              opacity: 0.8,
              backgroundColor: '$systemNoticeText',
            }}
            onPress={handlePrimaryAction}
          >
            <Button.Text color="$systemNoticeBackground" fontWeight="500">
              {perms.canAskPermission ? 'Enable' : 'Settings'}
            </Button.Text>
          </Button>
        </XStack>
      </YStack>
    </NoticeFrame>
  );
}

export function ContactBookPrompt(props: {
  status: 'denied' | 'granted' | 'undetermined';
  onDismiss: () => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
}) {
  const store = useStore();
  const perms = useContactPermissions();
  const contactBookNag = useNag({
    key: 'contactBookPrompt',
  });

  const handleDismiss = useCallback(() => {
    contactBookNag.dismiss();
  }, [contactBookNag]);

  const handlePrimaryAction = useCallback(async () => {
    if (perms.canAskPermission) {
      const result = await perms.requestPermissions();
      if (result === 'granted') {
        await store.syncSystemContacts().then(() => {
          Alert.alert('Success', 'Your contacts have been synced.');
        });
        await store.syncContactDiscovery().catch(() => {
          contactBookNag.eliminate();
        });
        contactBookNag.eliminate();
      } else {
        contactBookNag.dismiss();
      }
    } else {
      perms.openSettings();
    }
  }, [contactBookNag, perms, store]);

  if (
    isWeb ||
    perms.isLoading ||
    perms.status === 'granted' ||
    contactBookNag.isLoading ||
    !contactBookNag.shouldShow
  ) {
    return null;
  }

  return (
    <NoticeFrame>
      <YStack gap="$5xl">
        <YStack gap="$xl">
          <NoticeTitle>Find Friends</NoticeTitle>
          <NoticeBody>
            Sync your contact book to easily find people you know on Tlon.
          </NoticeBody>
        </YStack>
        {props.status === 'undetermined' && (
          <XStack gap="$m" justifyContent="flex-end">
            <Button
              padding="$xl"
              paddingHorizontal="$2xl"
              backgroundColor="$systemNoticeBackground"
              borderColor="$positiveBorder"
              borderWidth={1.6}
              pressStyle={{
                opacity: 0.7,
                backgroundColor: '$systemNoticeBackground',
              }}
              onPress={handleDismiss}
            >
              <Button.Text color="$systemNoticeText" fontWeight="500">
                Not Now
              </Button.Text>
            </Button>
            <Button
              backgroundColor="$systemNoticeText"
              padding="$xl"
              paddingHorizontal="$2xl"
              borderWidth={0}
              pressStyle={{
                opacity: 0.8,
                backgroundColor: '$systemNoticeText',
              }}
              onPress={handlePrimaryAction}
            >
              <Button.Text color="$systemNoticeBackground" fontWeight="500">
                Continue
              </Button.Text>
            </Button>
          </XStack>
        )}
        {props.status === 'denied' && (
          <Button>
            <Button.Text color="$systemNoticeText">Open Settings</Button.Text>
          </Button>
        )}
      </YStack>
    </NoticeFrame>
  );
}

export function JoinRequestNotice(params: {
  onViewRequests: () => void;
  onDismiss: () => void;
}) {
  return (
    <NoticeFrame gap="$2xl">
      <NoticeTitle>Pending Member Requests</NoticeTitle>
      <XStack gap="$m" justifyContent="flex-end">
        <Button
          padding="$l"
          paddingHorizontal="$2xl"
          backgroundColor="$systemNoticeBackground"
          borderColor="$positiveBorder"
          borderWidth={1.6}
          pressStyle={{
            opacity: 0.7,
            backgroundColor: '$systemNoticeBackground',
          }}
          onPress={params.onDismiss}
        >
          <Button.Text color="$systemNoticeText" fontWeight="500">
            Dismiss
          </Button.Text>
        </Button>
        <Button
          backgroundColor="$systemNoticeText"
          padding="$l"
          paddingHorizontal="$2xl"
          borderWidth={0}
          pressStyle={{
            opacity: 0.8,
            backgroundColor: '$systemNoticeText',
          }}
          onPress={params.onViewRequests}
        >
          <Button.Text color="$systemNoticeBackground" fontWeight="500">
            View Requests
          </Button.Text>
        </Button>
      </XStack>
    </NoticeFrame>
  );
}

export function ConnectedJoinRequestNotice({
  group,
  onViewRequests,
}: {
  group?: db.Group | null;
  onViewRequests: () => void;
}) {
  const store = useStore();

  // see if we have any pending join requests that haven't been dismissed
  const hasRelevantJoinRequests = useMemo(() => {
    if (group && group.joinRequests && group.joinRequests.length > 0) {
      const dismissedAt = group.pendingMembersDismissedAt ?? 0;
      return group.joinRequests.some((jr) => {
        const requestedAt = jr.requestedAt ?? Date.now() - 24 * 60 * 60 * 1000;
        return requestedAt > dismissedAt;
      });
    }
    return false;
  }, [group]);

  // handler to dismiss join requests
  const handleDismissJoinRequests = useCallback(() => {
    if (group) {
      store.updatePendingMemberDismissal({
        groupId: group.id,
        dismissedAt: Date.now(),
      });
    }
  }, [group, store]);

  // clear any unread counts for the join requests whenever displayed
  useEffect(() => {
    if (group && hasRelevantJoinRequests) {
      store.markGroupRead(group.id, false);
    }
  }, [group, hasRelevantJoinRequests, store]);

  if (!hasRelevantJoinRequests) {
    return null;
  }

  return (
    <SystemNotices.JoinRequestNotice
      onViewRequests={onViewRequests}
      onDismiss={handleDismissJoinRequests}
    />
  );
}

export function NonHostAdminChannelNotice() {
  return (
    <NoticeFrame>
      <NoticeBody>
        Note: You are not the host of this group. Channels you create will be
        hosted on your node and will operate independently of the group host.
      </NoticeBody>
    </NoticeFrame>
  );
}
