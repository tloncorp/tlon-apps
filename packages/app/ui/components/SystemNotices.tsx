import { AnalyticsEvent, createDevLogger, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Icon, type IconType, Text } from '@tloncorp/ui';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Alert, Platform } from 'react-native';
import { View, XStack, YStack, isWeb, styled } from 'tamagui';

import { useContactPermissions } from '../../hooks/useContactPermissions';
import { useNag } from '../../hooks/useNag';
import { useNotificationPermissions } from '../../lib/notifications';
import { useTopLevelTabBarContentInset } from '../../navigation/useTopLevelTabBarContentInset';

const logger = createDevLogger('SystemNotices', false);

export type SystemNoticePresentation = 'expanded' | 'compact';

const SystemNoticePresentationContext =
  createContext<SystemNoticePresentation | null>(null);

export const SystemNoticePresentationProvider =
  SystemNoticePresentationContext.Provider;

function useSystemNoticePresentation(
  presentation: SystemNoticePresentation | undefined,
  fallback: SystemNoticePresentation
) {
  const contextPresentation = useContext(SystemNoticePresentationContext);
  return presentation ?? contextPresentation ?? fallback;
}

const NoticeContainer = styled(View, {
  width: '100%',
  minWidth: '100%',
  alignSelf: 'stretch',
  variants: {
    horizontalInset: {
      true: {
        paddingHorizontal: '$xl',
      },
    },
  } as const,
});

const NoticeCardFrame = styled(YStack, {
  width: '100%',
  backgroundColor: '$background',
  padding: 20,
  borderRadius: '$xl',
  borderWidth: 1,
  borderColor: '$border',
});

const NoticeBody = styled(Text, {
  color: '$secondaryText',
  size: '$label/m',
  trimmed: false,
});

const NoticeTitle = styled(Text, {
  color: '$primaryText',
  size: '$label/l',
  fontWeight: '600',
  trimmed: false,
});

const NoticeIconFrame = styled(View, {
  width: 40,
  height: 40,
  borderRadius: '$l',
  backgroundColor: '$secondaryBackground',
  alignItems: 'center',
  justifyContent: 'center',
});

const NoticeBannerFrame = styled(XStack, {
  width: '100%',
  height: 56,
  paddingHorizontal: '$xl',
  borderRadius: '$xl',
  backgroundColor: '$secondaryBackground',
  alignItems: 'center',
  gap: '$m',
});

function NoticeIcon({
  type,
  compact = false,
}: {
  type: IconType;
  compact?: boolean;
}) {
  if (compact) {
    return <Icon type={type} customSize={[24, 20]} color="$primaryText" />;
  }

  return (
    <NoticeIconFrame>
      <Icon type={type} customSize={[24, 22]} color="$primaryText" />
    </NoticeIconFrame>
  );
}

function NoticeCard({
  icon,
  title,
  children,
  actions,
  horizontalInset = true,
  ...frameProps
}: {
  icon: IconType;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  horizontalInset?: boolean;
} & React.ComponentProps<typeof NoticeContainer>) {
  return (
    <NoticeContainer horizontalInset={horizontalInset} {...frameProps}>
      <NoticeCardFrame>
        <XStack gap="$l" alignItems="flex-start">
          <NoticeIcon type={icon} />
          <YStack flex={1}>
            <NoticeTitle>{title}</NoticeTitle>
            <NoticeBody>{children}</NoticeBody>
          </YStack>
        </XStack>
        {actions ? <View marginTop="$xl">{actions}</View> : null}
      </NoticeCardFrame>
    </NoticeContainer>
  );
}

function NoticeBanner({
  icon,
  title,
  actionLabel,
  onAction,
  onDismiss,
  horizontalInset = true,
  ...containerProps
}: {
  icon: IconType;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  horizontalInset?: boolean;
} & React.ComponentProps<typeof NoticeContainer>) {
  return (
    <NoticeContainer horizontalInset={horizontalInset} {...containerProps}>
      <NoticeBannerFrame>
        <NoticeIcon type={icon} compact />
        <NoticeTitle flex={1} numberOfLines={1}>
          {title}
        </NoticeTitle>
        {actionLabel && onAction ? (
          <Button
            preset="primary"
            label={actionLabel}
            size="small"
            height={32}
            minHeight={32}
            paddingHorizontal="$l"
            paddingVertical={0}
            borderRadius="$l"
            centered
            onPress={onAction}
          />
        ) : null}
        {onDismiss ? (
          <Button
            icon="Close"
            size="small"
            intent="secondary"
            fill="text"
            width={24}
            minWidth={24}
            height={24}
            minHeight={24}
            padding={0}
            aria-label="Dismiss"
            onPress={onDismiss}
          />
        ) : null}
      </NoticeBannerFrame>
    </NoticeContainer>
  );
}

function NoticeActions({ children }: { children: ReactNode }) {
  return (
    <XStack width="100%" gap="$m">
      {children}
    </XStack>
  );
}

const noticeActionProps = {
  flex: 1,
  height: 40,
  minHeight: 40,
  size: 'medium' as const,
  paddingVertical: 0,
  borderRadius: '$l' as const,
  centered: true,
};

const SystemNotices = {
  ContactBookPrompt,
  ContactBookPromptView,
  NotificationsPrompt,
  NotificationsPromptView,
  JoinRequestNotice,
  ConnectedJoinRequestNotice,
  NonHostAdminChannelNotice,
  PresentationProvider: SystemNoticePresentationProvider,
  NoticeFrame: NoticeCardFrame,
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

  const handlePrimaryAction = useCallback(() => {
    logger.trackEvent(AnalyticsEvent.ActionNotifPermsSettingsOpened);
    openedSettingsRef.current = true;
    perms.openSettings();
  }, [perms]);

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
    <NotificationsPromptView
      primaryActionLabel="Settings"
      onDismiss={handleDismiss}
      onPrimaryAction={handlePrimaryAction}
    />
  );
}

export function NotificationsPromptView({
  primaryActionLabel,
  onDismiss,
  onPrimaryAction,
  presentation: presentationOverride,
}: {
  primaryActionLabel: 'Enable' | 'Settings';
  onDismiss: () => void;
  onPrimaryAction: () => void;
  presentation?: SystemNoticePresentation;
}) {
  const tabBarContentInset = useTopLevelTabBarContentInset();
  const bottomContentInset =
    Platform.OS === 'ios' ? tabBarContentInset : undefined;
  const presentation = useSystemNoticePresentation(
    presentationOverride,
    'expanded'
  );

  if (presentation === 'compact') {
    return (
      <NoticeBanner
        icon="Notifications"
        title="Turn on notifications"
        actionLabel={primaryActionLabel}
        onAction={onPrimaryAction}
        onDismiss={onDismiss}
        marginBottom={bottomContentInset}
      />
    );
  }

  return (
    <NoticeCard
      icon="Notifications"
      title="Stay in the loop"
      marginBottom={bottomContentInset}
      actions={
        <NoticeActions>
          <Button
            {...noticeActionProps}
            intent="primary"
            fill="ghost"
            backgroundColor="$secondaryBackground"
            label="Not now"
            onPress={onDismiss}
          />
          <Button
            {...noticeActionProps}
            preset="primary"
            label={primaryActionLabel}
            onPress={onPrimaryAction}
          />
        </NoticeActions>
      }
    >
      Turn on notifications for new messages, mentions, and invites.
    </NoticeCard>
  );
}

export function ContactBookPrompt(props: {
  status: 'denied' | 'granted' | 'undetermined';
  onDismiss: () => void;
  onRequestAccess: () => void;
  onOpenSettings: () => void;
}) {
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
        const result = await store.syncContactDiscovery().catch(() => null);
        if (result?.didDiscover) {
          trackEvent(AnalyticsEvent.ContactDiscoveryCompleted);
        }
        contactBookNag.eliminate();
      } else {
        contactBookNag.dismiss();
      }
    } else {
      perms.openSettings();
    }
  }, [contactBookNag, perms]);

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
    <ContactBookPromptView
      status={props.status}
      onDismiss={handleDismiss}
      onPrimaryAction={handlePrimaryAction}
    />
  );
}

export function ContactBookPromptView({
  status,
  onDismiss,
  onPrimaryAction,
  presentation: presentationOverride,
}: {
  status: 'denied' | 'granted' | 'undetermined';
  onDismiss: () => void;
  onPrimaryAction: () => void;
  presentation?: SystemNoticePresentation;
}) {
  const presentation = useSystemNoticePresentation(
    presentationOverride,
    'expanded'
  );

  if (presentation === 'compact') {
    return (
      <NoticeBanner
        icon="AddPerson"
        title="Find people you know"
        actionLabel={status === 'denied' ? 'Settings' : 'Continue'}
        onAction={onPrimaryAction}
        onDismiss={onDismiss}
        marginTop="$xl"
      />
    );
  }

  return (
    <NoticeCard
      icon="AddPerson"
      title="Find people you know"
      marginTop="$xl"
      actions={
        status === 'undetermined' ? (
          <NoticeActions>
            <Button
              {...noticeActionProps}
              intent="primary"
              fill="ghost"
              backgroundColor="$secondaryBackground"
              label="Not now"
              onPress={onDismiss}
            />
            <Button
              {...noticeActionProps}
              preset="primary"
              label="Continue"
              onPress={onPrimaryAction}
            />
          </NoticeActions>
        ) : status === 'denied' ? (
          <NoticeActions>
            <Button
              {...noticeActionProps}
              preset="primary"
              label="Open Settings"
              onPress={onPrimaryAction}
            />
          </NoticeActions>
        ) : null
      }
    >
      Match with people in your contacts. We send anonymous hashes—not your
      address book.
    </NoticeCard>
  );
}

export function JoinRequestNotice(params: {
  onViewRequests: () => void;
  onDismiss: () => void;
  horizontalInset?: boolean;
  marginTop?: React.ComponentProps<typeof NoticeContainer>['marginTop'];
  presentation?: SystemNoticePresentation;
}) {
  const presentation = useSystemNoticePresentation(
    params.presentation,
    'compact'
  );

  if (presentation === 'expanded') {
    return (
      <NoticeCard
        icon="Profile"
        title="New join requests"
        horizontalInset={params.horizontalInset}
        marginTop={params.marginTop}
        actions={
          <NoticeActions>
            <Button
              {...noticeActionProps}
              intent="primary"
              fill="ghost"
              backgroundColor="$secondaryBackground"
              label="Not now"
              onPress={params.onDismiss}
            />
            <Button
              {...noticeActionProps}
              preset="primary"
              label="Review"
              onPress={params.onViewRequests}
            />
          </NoticeActions>
        }
      >
        Review people waiting to join this group.
      </NoticeCard>
    );
  }

  return (
    <NoticeBanner
      icon="Profile"
      title="New join requests"
      actionLabel="Review"
      onAction={params.onViewRequests}
      onDismiss={params.onDismiss}
      horizontalInset={params.horizontalInset}
      marginTop={params.marginTop}
    />
  );
}

export function ConnectedJoinRequestNotice({
  group,
  onViewRequests,
  horizontalInset,
  marginTop,
  presentation,
}: {
  group?: db.Group | null;
  onViewRequests: () => void;
  horizontalInset?: boolean;
  marginTop?: React.ComponentProps<typeof NoticeContainer>['marginTop'];
  presentation?: SystemNoticePresentation;
}) {
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
  }, [group]);

  // clear any unread counts for the join requests whenever displayed
  useEffect(() => {
    if (group && hasRelevantJoinRequests) {
      store.markGroupRead(group.id, false);
    }
  }, [group, hasRelevantJoinRequests]);

  if (!hasRelevantJoinRequests) {
    return null;
  }

  return (
    <SystemNotices.JoinRequestNotice
      onViewRequests={onViewRequests}
      onDismiss={handleDismissJoinRequests}
      horizontalInset={horizontalInset}
      marginTop={marginTop}
      presentation={presentation}
    />
  );
}

export function NonHostAdminChannelNotice({
  presentation: presentationOverride,
  bucketHostedByGroup = false,
}: {
  presentation?: SystemNoticePresentation;
  // A Bucket is always hosted by the group host, so the notice says the
  // opposite of what it says for a channel on your own node.
  bucketHostedByGroup?: boolean;
} = {}) {
  const presentation = useSystemNoticePresentation(
    presentationOverride,
    'expanded'
  );
  const title = bucketHostedByGroup
    ? "Hosted on the group host's node"
    : 'Hosted on your node';

  if (presentation === 'compact') {
    return <NoticeBanner icon="Info" title={title} horizontalInset={false} />;
  }

  return (
    <NoticeCard icon="Info" title={title} horizontalInset={false}>
      {bucketHostedByGroup
        ? "This Bucket will be hosted by the group host and will use the group host's storage."
        : 'This channel will run independently from the group host.'}
    </NoticeCard>
  );
}
