import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as Clipboard from 'expo-clipboard';
import { capitalize } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { RootStackParamList, RootStackRouteProp } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  ForwardGroupSheetProvider,
  InviteUsersSheet,
  ListItem,
  PaddedBlock,
  ProfileButton,
  ScreenHeader,
  ScrollView,
  TlonText,
  View,
  XStack,
  YStack,
  createActionGroup,
  pluralize,
  useChatOptions,
  useChatTitle,
  useCurrentUserId,
  useForwardGroupSheet,
  useGroupTitle,
  useIsAdmin,
  useIsWindowNarrow,
  useToast,
} from '../../ui';
import {
  ChannelQuickActions,
  LeaveActionsSection,
  MembersList,
  SettingsSection,
} from './chatDetails';
import { useShipConnectionStatus } from './useShipConnectionStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetails'>;

export function ChatDetailsScreen(props: Props) {
  const { chatType, chatId } = props.route.params;

  const { navigation } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);

  const handleInvitePressed = useCallback(
    (groupId: string) => {
      if (isWindowNarrow) {
        // Mobile: Use navigation to screen
        navigation.navigate('InviteUsers', { groupId });
      } else {
        // Desktop: Use sheet
        setInviteSheetGroup(groupId);
      }
    },
    [isWindowNarrow, navigation]
  );

  return (
    <ForwardGroupSheetProvider>
      <ChatOptionsProvider
        key={`${chatType}-${chatId}`}
        initialChat={{
          type: chatType,
          id: chatId,
        }}
        onPressInvite={handleInvitePressed}
        {...useChatSettingsNavigation()}
      >
        <ChatDetailsScreenView />
        {!isWindowNarrow && (
          <InviteUsersSheet
            open={inviteSheetGroup !== null}
            onOpenChange={(open) => {
              if (!open) {
                setInviteSheetGroup(null);
              }
            }}
            groupId={inviteSheetGroup ?? undefined}
            onInviteComplete={() => setInviteSheetGroup(null)}
          />
        )}
      </ChatOptionsProvider>
    </ForwardGroupSheetProvider>
  );
}

function ChatDetailsScreenView() {
  const {
    params: { chatType, chatId },
  } = useRoute<RootStackRouteProp<'ChatDetails'>>();
  const { channel, group } = useChatOptions();
  const {
    onPressGroupMeta: navigateToGroupMeta,
    onPressEditChannelMeta,
    onPressEditChannelPrivacy,
  } = useChatSettingsNavigation();
  const { navigateToGroup, navigateToChannel, navigateBack } =
    useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: !!group,
  });
  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';
  const canInviteToGroup =
    (currentUserIsAdmin && actionsEnabled) || group?.privacy === 'public';

  const groupTitle = useGroupTitle(group) ?? 'group';
  const title = useChatTitle(channel, group);
  const insets = useSafeAreaInsets();

  const members = chatType === 'group' ? group?.members : channel?.members;
  const memberCount = members?.length ?? 0;

  const subtitle = useMemo(() => {
    if (chatType === 'group') {
      return [
        group?.privacy ? `${capitalize(group.privacy)} group` : 'Group',
        memberCount
          ? `with ${memberCount} ${pluralize(memberCount, 'member')}`
          : null,
      ]
        .filter((n) => !!n)
        .join(' ');
    }

    if (!channel) {
      return '';
    }

    switch (channel.type) {
      case 'dm':
        return `Chat with ${channel.contactId}`;
      case 'groupDm':
        return channel.members && channel.members?.length > 2
          ? `Chat with ${channel.members[0].contactId} and ${channel.members?.length - 1} others`
          : 'Group chat';
      default:
        return group
          ? group.channels?.length === 1
            ? `Group with ${group.members?.length ?? 0} members`
            : `Channel in ${groupTitle}`
          : '';
    }
  }, [channel, chatType, group, groupTitle, memberCount]);

  const handlePressEdit = useCallback(() => {
    if (chatType === 'group' && group) {
      navigateToGroupMeta(group.id);
    } else if (chatType === 'channel' && channel && channel.groupId) {
      onPressEditChannelMeta(channel.id, channel.groupId, true);
    }
  }, [channel, chatType, group, onPressEditChannelMeta, navigateToGroupMeta]);

  const handleEditChannelPrivacy = useCallback(
    (channelId: string, groupId: string) => {
      onPressEditChannelPrivacy(channelId, groupId, true);
    },
    [onPressEditChannelPrivacy]
  );

  const handleGoBack = useCallback(() => {
    if (isWindowNarrow) {
      navigateBack();
    } else if (chatType === 'group') {
      navigateToGroup(chatId);
    } else if (chatType === 'channel' && channel) {
      navigateToChannel(channel);
    } else {
      navigateBack();
    }
  }, [
    chatType,
    chatId,
    channel,
    navigateToGroup,
    navigateToChannel,
    navigateBack,
    isWindowNarrow,
  ]);

  const getTitle = () => {
    switch (chatType) {
      case 'group':
        return 'Group info & settings';
      case 'channel':
        return 'Channel info';
      default:
        return 'Info';
    }
  };

  const hasContent =
    (chatType === 'channel' && channel) || (chatType === 'group' && group);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        testID="ChatDetailsHeader"
        backgroundColor="$secondaryBackground"
        backAction={handleGoBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        title={getTitle()}
        rightControls={
          currentUserIsAdmin ? (
            <ScreenHeader.TextButton
              onPress={!actionsEnabled ? undefined : handlePressEdit}
              disabled={!actionsEnabled}
              color="$primaryText"
              testID="DetailsEditButton"
            >
              Rename
            </ScreenHeader.TextButton>
          ) : null
        }
      />
      {hasContent && (
        <ScrollView
          flex={1}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 600,
            marginHorizontal: 'auto',
            gap: '$l',
            paddingBottom: insets.bottom + getTokenValue('$3xl' as any),
          }}
        >
          <XStack
            alignItems="flex-start"
            gap="$xl"
            paddingHorizontal="$xl"
            marginVertical="$l"
          >
            {chatType === 'group' && group ? (
              <ListItem.GroupIcon
                testID="GroupIcon"
                model={group}
                size="$5xl"
              />
            ) : chatType === 'channel' && channel && group ? (
              <ListItem.GroupIcon model={group} size="$5xl" />
            ) : chatType === 'channel' && channel ? (
              <ListItem.ChannelIcon model={channel} size="$5xl" />
            ) : null}
            <YStack gap="$l" flex={1}>
              <TlonText.Text>{title}</TlonText.Text>
              <TlonText.Text size={'$label/m'} color={'$secondaryText'}>
                {subtitle}
              </TlonText.Text>
            </YStack>
          </XStack>

          {chatType === 'group' && group && (
            <>
              <GroupQuickActions group={group} canInvite={canInviteToGroup} />
              <GroupDescription group={group} />
              <SettingsSection
                entityType="group"
                group={group}
                actionsEnabled={actionsEnabled}
              />
            </>
          )}

          {chatType === 'channel' && channel && channel.groupId && (
            <>
              <ChannelQuickActions
                channel={channel}
                canInvite={canInviteToGroup}
              />
              <SettingsSection
                entityType="channel"
                channel={channel}
                group={group}
                actionsEnabled={actionsEnabled}
                onEditChannelPrivacy={handleEditChannelPrivacy}
              />
            </>
          )}

          {members?.length ? (
            <MembersList
              entityType={chatType}
              members={members}
              canInvite={canInviteToGroup}
              canManage={currentUserIsAdmin && actionsEnabled}
            />
          ) : null}

          {chatType === 'group' && group ? (
            <LeaveActionsSection entityType="group" group={group} />
          ) : null}
          {chatType === 'channel' && channel && channel.groupId && (
            <LeaveActionsSection entityType="channel" channel={channel} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function GroupQuickActions({
  group,
  canInvite,
}: {
  group: db.Group;
  canInvite?: boolean;
}) {
  const { markGroupRead, togglePinned, onPressInvite } = useChatOptions();
  const forwardGroupSheet = useForwardGroupSheet();
  const isPinned = group?.pin;
  const canMarkRead = !(group.unread?.count === 0);
  const toast = useToast();

  const handleForwardGroup = useCallback(() => {
    forwardGroupSheet.open(group);
  }, [forwardGroupSheet, group]);

  const handleCopyShortcode = useCallback(async () => {
    await Clipboard.setStringAsync(group.id);
    toast({ message: 'Copied!', duration: 1500 });
  }, [group.id, toast]);

  const heroActions = useMemo(
    () =>
      createActionGroup(
        'neutral',
        canInvite && {
          title: 'Invite',
          action: onPressInvite,
        }
      ),
    [canInvite, onPressInvite]
  );

  const secondaryActions = useMemo(
    () =>
      createActionGroup(
        'neutral',
        canMarkRead && {
          title: 'Mark read',
          disabled: !canMarkRead,
          action: markGroupRead,
        },
        {
          title: isPinned ? 'Unpin' : 'Pin',
          endIcon: 'Pin',
          action: togglePinned,
        },
        {
          title: 'Forward reference',
          action: handleForwardGroup,
        },
        {
          title: 'Copy group ID',
          action: handleCopyShortcode,
        }
      ),
    [
      canMarkRead,
      isPinned,
      handleCopyShortcode,
      handleForwardGroup,
      markGroupRead,
      togglePinned,
    ]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      width={'100%'}
      paddingLeft={'$l'}
    >
      {heroActions.actions.map((action, i) => (
        <ProfileButton
          key={i}
          title={action.title}
          onPress={action.action}
          disabled={action.disabled}
          testID={`GroupQuickAction-${action.title}`}
          hero
        />
      ))}
      {secondaryActions.actions.map((action, i) => (
        <ProfileButton
          key={i}
          title={action.title}
          onPress={action.action}
          disabled={action.disabled}
          testID={`GroupQuickAction-${action.title}`}
        />
      ))}
    </ScrollView>
  );
}

const GroupDescription = ({ group }: { group: db.Group }) => {
  if (!group.description) {
    return null;
  }

  return (
    <View paddingHorizontal={'$l'}>
      <PaddedBlock width="100%" gap="$xl">
        <TlonText.Text size="$label/m" color="$tertiaryText">
          Description
        </TlonText.Text>
        <TlonText.Text size="$body" color="$primaryText">
          {group.description}
        </TlonText.Text>
      </PaddedBlock>
    </View>
  );
};
