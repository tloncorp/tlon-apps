import { FlashList, ListRenderItem } from '@shopify/flash-list';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import {
  SectionListHeader,
  Text,
  pluralize,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { LoadingSpinner } from '@tloncorp/ui';
import { capitalize } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  YStack,
  getTokenValue,
  getVariableValue,
  useTheme,
} from 'tamagui';

import { useShipConnectionStatus } from '../../features/top/useShipConnectionStatus';
import { useRenderCount } from '../../hooks/useRenderCount';
import { useRootNavigation } from '../../navigation/utils';
import { useCurrentUserId } from '../contexts/appDataContext';
import { useChatOptions } from '../contexts/chatOptions';
import { useNotebookSidebarContent } from '../contexts/notebookSidebar';
import { useGroupTitle, useIsAdmin } from '../utils/channelUtils';
import { getGroupChannelSections } from '../utils/groupChannelSections';
import { getGroupMemberCount } from '../utils/groupUtils';
import { Badge } from './Badge';
import { GroupAvatar } from './GroupAvatar';
import { CreateChannelSheet } from './ManageChannels/CreateChannelSheet';
import { useTopLevelDrawerToggleAction } from '../../navigation/useTopLevelDrawerToggle';
import { ScreenHeader } from './ScreenHeader';
import SystemNotices from './SystemNotices';
import WayfindingNotice from './Wayfinding/Notices';
import { ChannelListItem } from './listItems/ChannelListItem';
import { useScreenScrollProps } from './useScreenScrollProps';

type SectionHeaderData = { type: 'sectionHeader'; title: string; id: string };
type ChannelListData = db.Channel | SectionHeaderData;

function isSectionHeader(item: ChannelListData): item is SectionHeaderData {
  return 'type' in item && item.type === 'sectionHeader';
}

type GroupChannelsScreenViewProps = {
  disabled?: boolean;
  group: db.Group | null;
  focusedChannelId?: string;
  unjoinedChannels?: db.Channel[];
  onChannelPressed: (channel: db.Channel) => void;
  onJoinChannel: (channel: db.Channel) => void;
  onBackPressed: () => void;
  onGoToGroupMembers: () => void;
  onPressManageChannels: (groupId: string, fromChatDetails?: boolean) => void;
  /**
   * The drawer opened this list, so it is a destination rather than something
   * pushed over the group: the drawer button takes the caret's slot.
   */
  isDrawerDestination?: boolean;
};

export const GroupChannelsScreenView = React.memo(
  function GroupChannelsScreenViewComponent({
    group,
    disabled = false,
    focusedChannelId,
    unjoinedChannels = [],
    onChannelPressed,
    onJoinChannel,
    onBackPressed,
    onGoToGroupMembers,
    onPressManageChannels,
    isDrawerDestination = false,
  }: GroupChannelsScreenViewProps) {
    useRenderCount('GroupChannelsScreenView');
    const drawerToggle = useTopLevelDrawerToggleAction({
      onPushedScreen: isDrawerDestination,
    });
    const showsDrawerToggle = isDrawerDestination && drawerToggle != null;
    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const sortBy = db.channelSortPreference.useValue();
    const insets = useSafeAreaInsets();
    const userId = useCurrentUserId();
    const isGroupAdmin = useIsAdmin(group?.id ?? '', userId);
    const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
      enabled: !!group,
    });
    const canEdit = hostStatus.complete && hostStatus.status === 'yes';

    const chatOptions = useChatOptions();
    const { navigateToChatDetails } = useRootNavigation();

    const handleTitlePress = useCallback(() => {
      if (group && !disabled) {
        navigateToChatDetails({ type: 'group', id: group.id });
      }
    }, [disabled, group, navigateToChatDetails]);

    const isPersonalGroup = useMemo(() => {
      return logic.isPersonalGroup(group, userId);
    }, [group, userId]);

    const handleOpenChannelOptions = useCallback(
      (channel: db.Channel) => {
        if (group) {
          chatOptions.open(channel.id, 'channel');
        }
      },
      [group, chatOptions]
    );

    const title = useGroupTitle(group);

    const subtitle = useMemo(() => {
      if (group?.description) {
        return group.description;
      }
      const memberCount = group ? getGroupMemberCount(group) : 0;
      const privacy = group?.privacy
        ? `${capitalize(group.privacy)} group`
        : 'Group';

      if (memberCount > 0) {
        return `${privacy} with ${memberCount} ${pluralize(memberCount, 'member')}`;
      }
      return privacy;
    }, [group]);

    const listSectionTitleColor = getVariableValue(useTheme().secondaryText);
    const isWindowNarrow = useIsWindowNarrow();
    const notebookSidebarContent = useNotebookSidebarContent();
    const [
      dismissedNotebookSidebarChannelId,
      setDismissedNotebookSidebarChannelId,
    ] = useState<string | null>(null);
    const shouldShowNotebookSidebar =
      !isWindowNarrow &&
      !!notebookSidebarContent &&
      notebookSidebarContent.groupId === group?.id &&
      notebookSidebarContent.channelId === focusedChannelId &&
      dismissedNotebookSidebarChannelId !== notebookSidebarContent.channelId;
    const screenScrollProps = useScreenScrollProps({
      enabled: !shouldShowNotebookSidebar && (group?.channels?.length ?? 0) > 0,
    });

    useEffect(() => {
      setDismissedNotebookSidebarChannelId(null);
    }, [focusedChannelId]);

    const handleChannelPress = useCallback(
      (channel: db.Channel) => {
        if (channel.id === dismissedNotebookSidebarChannelId) {
          setDismissedNotebookSidebarChannelId(null);
        }
        onChannelPressed(channel);
      },
      [dismissedNotebookSidebarChannelId, onChannelPressed]
    );

    const handleDismissNotebookSidebar = useCallback(() => {
      if (notebookSidebarContent) {
        setDismissedNotebookSidebarChannelId(notebookSidebarContent.channelId);
      }
    }, [notebookSidebarContent]);

    const listItems: ChannelListData[] = useMemo(() => {
      if (!group || !group.channels || group.channels.length === 0) {
        return [];
      }

      const result: ChannelListData[] = [];

      getGroupChannelSections(group, sortBy).forEach((section) => {
        result.push({
          type: 'sectionHeader',
          title: section.title,
          id: section.id,
        });
        result.push(...section.channels);
      });

      // Add unjoined channels section
      if (unjoinedChannels.length > 0) {
        result.push({
          type: 'sectionHeader',
          title: 'Available Channels',
          id: 'available-channels',
        });
        result.push(...unjoinedChannels);
      }

      return result;
    }, [group, unjoinedChannels, sortBy]);

    const renderItem: ListRenderItem<ChannelListData> = useCallback(
      ({ item }) => {
        if (isSectionHeader(item)) {
          return (
            <SectionListHeader>
              <SectionListHeader.Text color={listSectionTitleColor}>
                {item.title}
              </SectionListHeader.Text>
            </SectionListHeader>
          );
        }

        // Check if it's an unjoined channel
        const isUnjoined = unjoinedChannels.some((c) => c.id === item.id);

        return (
          <ChannelListItem
            key={item.id}
            model={item}
            disabled={disabled}
            onPress={isUnjoined ? onJoinChannel : handleChannelPress}
            onLongPress={
              !isUnjoined && !disabled ? handleOpenChannelOptions : undefined
            }
            useTypeIcon={true}
            dimmed={isUnjoined || disabled}
            disableOptions={isUnjoined || disabled}
            EndContent={
              isUnjoined ? (
                <View justifyContent="center">
                  <Badge text="Join" />
                </View>
              ) : undefined
            }
          />
        );
      },
      [
        unjoinedChannels,
        disabled,
        onJoinChannel,
        handleChannelPress,
        handleOpenChannelOptions,
        listSectionTitleColor,
      ]
    );

    const keyExtractor = useCallback((item: ChannelListData) => item.id, []);

    const getItemType = useCallback((item: ChannelListData) => {
      return isSectionHeader(item) ? 'sectionHeader' : 'channel';
    }, []);

    if (shouldShowNotebookSidebar) {
      return (
        <View flex={1}>
          <ScreenHeader
            title={notebookSidebarContent.title}
            testID="NotebookSidebarBackHeader"
            borderBottom
            backAction={
              notebookSidebarContent.backAction ?? handleDismissNotebookSidebar
            }
            placement="navigation"
            rightActions={notebookSidebarContent.headerActions}
          />
          <YStack flex={1} minHeight={0}>
            {notebookSidebarContent.content}
          </YStack>
        </View>
      );
    }

    return (
      <View flex={1}>
        <ScreenHeader
          title={title}
          titleIcon={group ? <GroupAvatar model={group} size="$2xl" /> : null}
          testID="GroupChannelsHeaderTrigger"
          subtitle={subtitle}
          showSubtitle={isWindowNarrow}
          borderBottom={isWindowNarrow}
          backAction={showsDrawerToggle || disabled ? undefined : onBackPressed}
          leftActions={showsDrawerToggle ? [drawerToggle] : undefined}
          onTitlePress={disabled ? undefined : handleTitlePress}
          rightActions={[
            {
              id: 'edit-channels',
              icon: 'EditList',
              label: 'Edit channels',
              onPress: group
                ? () => onPressManageChannels(group.id, false)
                : undefined,
              disabled: disabled || !canEdit,
              visible: !!group && isGroupAdmin,
            },
          ]}
          placement="navigation"
        />
        {isPersonalGroup &&
          group &&
          (!group.channels || group.channels.length === 0) && (
            <WayfindingNotice.GroupChannels group={group} />
          )}
        {group && group.joinStatus === 'joining' ? (
          // Show loading spinner while group is syncing
          <YStack flex={1} justifyContent="center" alignItems="center">
            <LoadingSpinner />
          </YStack>
        ) : group && group.channels && group.channels.length > 0 ? (
          <YStack flex={1} minHeight={0}>
            <FlashList
              data={listItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              getItemType={getItemType}
              {...screenScrollProps}
              ListHeaderComponent={
                <YStack width="100%" minWidth="100%" alignSelf="stretch">
                  {isPersonalGroup ? (
                    <WayfindingNotice.GroupChannels group={group} />
                  ) : null}
                  <SystemNotices.ConnectedJoinRequestNotice
                    group={group}
                    onViewRequests={onGoToGroupMembers}
                    horizontalInset={false}
                  />
                </YStack>
              }
              ListHeaderComponentStyle={{
                width: '100%',
                minWidth: '100%',
                alignSelf: 'stretch',
              }}
              contentContainerStyle={{
                paddingTop: getTokenValue('$l'),
                paddingHorizontal: getTokenValue('$l'),
                paddingBottom: insets.bottom,
              }}
            />
          </YStack>
        ) : group && group.channels && group.channels.length === 0 ? (
          // Only show "no channels" message when we're certain the group has fully synced
          <YStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            gap="$m"
            padding="$m"
          >
            <Text color="$primaryText" fontSize="$m" textAlign="center">
              No channels available in this group yet.
            </Text>
            <Text color="$primaryText" fontSize="$m" textAlign="center">
              {isGroupAdmin
                ? 'Create a channel to get started.'
                : 'The group host can create channels or grant you access to existing ones.'}
            </Text>
          </YStack>
        ) : (
          // Show loading spinner while waiting for group data
          <YStack flex={1} justifyContent="center" alignItems="center">
            <LoadingSpinner />
          </YStack>
        )}

        {showCreateChannel && group && (
          <CreateChannelSheet
            onOpenChange={(open) => setShowCreateChannel(open)}
            group={group}
          />
        )}
      </View>
    );
  }
);
