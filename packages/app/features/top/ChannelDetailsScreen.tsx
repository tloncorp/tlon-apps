import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  Button,
  ChatOptionsProvider,
  ForwardGroupSheetProvider,
  InviteUsersSheet,
  ListItem,
  ScreenHeader,
  ScrollView,
  TlonText,
  View,
  XStack,
  YStack,
  useChatOptions,
  useChatTitle,
  useCurrentUserId,
  useGroupTitle,
  useIsAdmin,
  useIsWindowNarrow,
} from '../../ui';
import {
  PermissionTable,
  PrivateChannelToggle,
} from '../../ui/components/ManageChannels/ChannelPermissions';
import { processFinalPermissions } from '../../ui/components/ManageChannels/ChannelPermissionsContent';
import {
  ChannelPrivacyFormSchema,
  MEMBERS_MARKER,
  getChannelPrivacyDefaults,
} from '../../ui/components/ManageChannels/channelFormUtils';
import {
  ChannelQuickActions,
  LeaveActionsSection,
  MembersList,
  SettingsSection,
} from './chatDetails';
import { useShipConnectionStatus } from './useShipConnectionStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetails'>;

export function ChannelDetailsScreen(props: Props) {
  const { chatId, selectedRoleIds, createdRoleId, createdRoleTitle } =
    props.route.params;

  const { navigation } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);
  const chatSettingsNav = useChatSettingsNavigation();
  const { onPressEditChannelMeta } = chatSettingsNav;

  const handleInvitePressed = useCallback(
    (groupId: string) => {
      if (isWindowNarrow) {
        navigation.navigate('InviteUsers', { groupId });
      } else {
        setInviteSheetGroup(groupId);
      }
    },
    [isWindowNarrow, navigation]
  );

  const handleEditChannelMeta = useCallback(
    (channelId: string, groupId: string) => {
      onPressEditChannelMeta(channelId, groupId, true);
    },
    [onPressEditChannelMeta]
  );

  const handleSelectRoles = useCallback(
    (channelId: string, groupId: string, currentReaders: string[]) => {
      navigation.navigate('GroupSettings', {
        screen: 'SelectChannelRoles',
        params: {
          groupId,
          selectedRoleIds: currentReaders,
          returnScreen: 'ChatDetails',
          returnParams: {
            chatType: 'channel' as const,
            chatId: channelId,
            groupId,
          },
        },
      });
    },
    [navigation]
  );

  const handlePressRole = useCallback(
    (groupId: string, roleId: string) => {
      navigation.navigate('GroupSettings', {
        screen: 'EditRole',
        params: { groupId, roleId },
      });
    },
    [navigation]
  );

  return (
    <ForwardGroupSheetProvider>
      <ChatOptionsProvider
        key={`channel-${chatId}`}
        initialChat={{
          type: 'channel',
          id: chatId,
        }}
        onPressInvite={handleInvitePressed}
        {...chatSettingsNav}
      >
        <ChannelDetailsScreenView
          onEditChannelMeta={handleEditChannelMeta}
          onSelectRoles={handleSelectRoles}
          onPressRole={handlePressRole}
          selectedRoleIds={selectedRoleIds}
          createdRoleId={createdRoleId}
          createdRoleTitle={createdRoleTitle}
        />
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

export function ChannelDetailsScreenView({
  onGoBack,
  onEditChannelMeta,
  onSelectRoles,
  onPressRole,
  onAfterDeleteChannel,
  selectedRoleIds,
  createdRoleId,
  createdRoleTitle,
}: {
  onGoBack?: () => void;
  onEditChannelMeta: (channelId: string, groupId: string) => void;
  onSelectRoles?: (
    channelId: string,
    groupId: string,
    currentReaders: string[]
  ) => void;
  onPressRole?: (groupId: string, roleId: string) => void;
  onAfterDeleteChannel?: () => void;
  selectedRoleIds?: string[];
  createdRoleId?: string;
  createdRoleTitle?: string;
}) {
  const { channel, group } = useChatOptions();
  const { navigateToChannel, navigateBack } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: !!group,
  });
  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';
  const canInvite =
    (currentUserIsAdmin && actionsEnabled) || group?.privacy === 'public';

  const groupTitle = useGroupTitle(group) ?? 'group';
  const title = useChatTitle(channel, group);
  const insets = useSafeAreaInsets();

  const subtitle = useMemo(() => {
    if (!channel) return '';
    switch (channel.type) {
      case 'dm':
        return `Chat with ${channel.contactId}`;
      case 'groupDm':
        return channel.members &&
          channel.members.length > 0 &&
          channel.members.length > 2
          ? `Chat with ${channel.members[0].contactId} and ${channel.members.length - 1} others`
          : 'Group chat';
      default:
        return group
          ? group.channels?.length === 1
            ? `Group with ${group.members?.length ?? 0} members`
            : `Channel in ${groupTitle}`
          : '';
    }
  }, [channel, group, groupTitle]);

  const handlePressEdit = useCallback(() => {
    if (channel && channel.groupId) {
      onEditChannelMeta(channel.id, channel.groupId);
    }
  }, [channel, onEditChannelMeta]);

  const handleGoBack = useCallback(() => {
    if (onGoBack) {
      onGoBack();
      return;
    }
    if (isWindowNarrow) {
      navigateBack();
    } else if (channel) {
      navigateToChannel(channel);
    } else {
      navigateBack();
    }
  }, [onGoBack, channel, navigateToChannel, navigateBack, isWindowNarrow]);

  if (!channel) {
    return null;
  }

  const members = channel.members;
  const showInlinePermissions =
    currentUserIsAdmin && channel.groupId && group;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        testID="ChatDetailsHeader"
        backgroundColor="$secondaryBackground"
        backAction={handleGoBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        title="Channel info"
        rightControls={
          currentUserIsAdmin ? (
            <ScreenHeader.IconButton
              aria-label="Edit"
              onPress={!actionsEnabled ? undefined : handlePressEdit}
              disabled={!actionsEnabled}
              type="Draw"
              testID="DetailsEditButton"
            />
          ) : null
        }
      />
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
          {group ? (
            <ListItem.GroupIcon model={group} size="$5xl" />
          ) : (
            <ListItem.ChannelIcon model={channel} size="$5xl" />
          )}
          <YStack gap="$l" flex={1}>
            <TlonText.Text>{title}</TlonText.Text>
            <TlonText.Text size={'$label/m'} color={'$secondaryText'}>
              {subtitle}
            </TlonText.Text>
          </YStack>
        </XStack>

        {channel.groupId && (
          <>
            <ChannelQuickActions channel={channel} canInvite={canInvite} />
            <SettingsSection
              entityType="channel"
              channel={channel}
              group={group}
              actionsEnabled={actionsEnabled}
              hidePermissions={!!showInlinePermissions}
            />
          </>
        )}

        {showInlinePermissions && (
          <InlineChannelPermissions
            channel={channel}
            group={group}
            actionsEnabled={actionsEnabled}
            selectedRoleIds={selectedRoleIds}
            createdRoleId={createdRoleId}
            createdRoleTitle={createdRoleTitle}
            onSelectRoles={
              actionsEnabled && onSelectRoles
                ? (currentReaders) =>
                    onSelectRoles(channel.id, channel.groupId!, currentReaders)
                : undefined
            }
            onPressRole={
              actionsEnabled && onPressRole
                ? (roleId) => onPressRole(channel.groupId!, roleId)
                : undefined
            }
          />
        )}

        {members?.length ? (
          <MembersList
            entityType="channel"
            members={members}
            canInvite={canInvite}
            canManage={currentUserIsAdmin && actionsEnabled}
          />
        ) : null}

        {channel.groupId && (
          <LeaveActionsSection
            entityType="channel"
            channel={channel}
            onAfterDeleteChannel={onAfterDeleteChannel}
          />
        )}
      </ScrollView>
    </View>
  );
}

function InlineChannelPermissions({
  channel,
  group,
  actionsEnabled,
  selectedRoleIds,
  createdRoleId,
  createdRoleTitle,
  onSelectRoles,
  onPressRole,
}: {
  channel: db.Channel;
  group: db.Group;
  actionsEnabled: boolean;
  selectedRoleIds?: string[];
  createdRoleId?: string;
  createdRoleTitle?: string;
  onSelectRoles?: (currentReaders: string[]) => void;
  onPressRole?: (roleId: string) => void;
}) {
  const { updateChannel } = useGroupContext({ groupId: group.id });

  // Augment group roles with newly created role that may not be in group data yet
  const augmentedRoles = useMemo(() => {
    const roles = group.roles ?? [];
    if (
      createdRoleId &&
      createdRoleTitle &&
      !roles.some((r) => r.id === createdRoleId)
    ) {
      return [
        ...roles,
        { id: createdRoleId, title: createdRoleTitle } as db.GroupRole,
      ];
    }
    return roles;
  }, [group.roles, createdRoleId, createdRoleTitle]);

  const form = useForm<ChannelPrivacyFormSchema>({
    defaultValues: {
      isPrivate: false,
      readers: [],
      writers: [],
    },
  });

  const isPrivate = form.watch('isPrivate');
  const { isDirty } = form.formState;

  // Initialize form once when channel data first becomes available
  const formInitializedRef = useRef(false);
  useEffect(() => {
    if (!channel || formInitializedRef.current) return;
    formInitializedRef.current = true;
    const defaults = getChannelPrivacyDefaults(channel);
    form.reset({
      isPrivate: defaults.isPrivate,
      readers: defaults.readers,
      writers: defaults.writers,
    });
  }, [channel, form]);

  // Handle newly created role returned from AddRole screen (consume once)
  const consumedCreatedRoleRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !createdRoleId ||
      consumedCreatedRoleRef.current === createdRoleId
    )
      return;
    consumedCreatedRoleRef.current = createdRoleId;
    const currentReaders = form.getValues('readers');
    if (!currentReaders.includes(createdRoleId)) {
      const base = currentReaders.includes('admin')
        ? currentReaders
        : ['admin', ...currentReaders];
      form.setValue('readers', [...base, createdRoleId], { shouldDirty: true });
      form.setValue('isPrivate', true);
    }
  }, [createdRoleId, form]);

  // Handle roles selected from SelectChannelRoles screen
  useEffect(() => {
    if (!selectedRoleIds) return;
    form.setValue('readers', selectedRoleIds, { shouldDirty: true });
    const currentWriters = form.getValues('writers');
    form.setValue(
      'writers',
      currentWriters.filter((w) => selectedRoleIds.includes(w)),
      { shouldDirty: true }
    );
    form.setValue('isPrivate', true);
  }, [selectedRoleIds, form]);

  const handleTogglePrivate = useCallback(
    (value: boolean) => {
      form.setValue('isPrivate', value, { shouldDirty: true });
      if (value) {
        form.setValue('readers', ['admin', MEMBERS_MARKER], {
          shouldDirty: true,
        });
        form.setValue('writers', ['admin', MEMBERS_MARKER], {
          shouldDirty: true,
        });
      } else {
        form.setValue('readers', [], { shouldDirty: true });
        form.setValue('writers', [], { shouldDirty: true });
      }
    },
    [form]
  );

  const handleSelectRoles = useCallback(() => {
    const currentReaders = form.getValues('readers');
    onSelectRoles?.(currentReaders);
  }, [form, onSelectRoles]);

  const handleSave = useCallback(() => {
    if (!channel) return;

    const {
      readers: currentReaders,
      writers: currentWriters,
      isPrivate: currentIsPrivate,
    } = form.getValues();
    const { finalReaders, finalWriters } = processFinalPermissions(
      currentReaders,
      currentWriters,
      currentIsPrivate
    );

    updateChannel({ ...channel }, finalReaders, finalWriters);
    form.reset(form.getValues());
  }, [channel, form, updateChannel]);

  return (
    <FormProvider {...form}>
      <View paddingHorizontal="$l">
        <YStack gap="$l">
          <TlonText.Text size="$label/xl" color="$tertiaryText">
            Permissions
          </TlonText.Text>
          <YStack
            width="100%"
            overflow="hidden"
            borderRadius="$2xl"
            borderWidth={1}
            borderColor="$secondaryBorder"
            backgroundColor="$background"
          >
            <PrivateChannelToggle
              isPrivate={isPrivate}
              onTogglePrivate={
                actionsEnabled ? handleTogglePrivate : () => {}
              }
            />
          </YStack>
          <PermissionTable
            groupRoles={augmentedRoles}
            onPressRole={onPressRole}
            disabled={!actionsEnabled}
          />
          {isPrivate && actionsEnabled && onSelectRoles && (
            <Button onPress={handleSelectRoles} label="Add roles" />
          )}
          {isDirty && actionsEnabled && (
            <Button
              preset="hero"
              onPress={handleSave}
              label="Save permissions"
              testID="SavePermissionsButton"
            />
          )}
        </YStack>
      </View>
    </FormProvider>
  );
}
