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
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Popover,
  View,
  YStack,
  getTokenValue,
  getVariableValue,
  useTheme,
} from 'tamagui';

import { useShipConnectionStatus } from '../../features/top/useShipConnectionStatus';
import { useRenderCount } from '../../hooks/useRenderCount';
import { useRootNavigation } from '../../navigation/utils';
import { useChatOptions, useCurrentUserId } from '../contexts';
import { useGroupTitle, useIsAdmin } from '../utils/channelUtils';
import { GroupAvatar } from './Avatar';
import { Badge } from './Badge';
import { ChatOptionsSheet } from './ChatOptionsSheet';
import ConnectionStatus from './ConnectionStatus';
import { ChannelListItem } from './ListItem/ChannelListItem';
import { CreateChannelSheet } from './ManageChannels/CreateChannelSheet';
import { ScreenHeader } from './ScreenHeader';
import SystemNotices from './SystemNotices';
import WayfindingNotice from './Wayfinding/Notices';

type SectionHeaderData = { type: 'sectionHeader'; title: string; id: string };
type ChannelListData = db.Channel | SectionHeaderData;

function isSectionHeader(item: ChannelListData): item is SectionHeaderData {
  return 'type' in item && item.type === 'sectionHeader';
}

type GroupChannelsScreenViewProps = {
  group: db.Group | null;
  unjoinedChannels?: db.Channel[];
  onChannelPressed: (channel: db.Channel) => void;
  onJoinChannel: (channel: db.Channel) => void;
  onBackPressed: () => void;
  onGoToGroupMembers: () => void;
  onPressManageChannels: (groupId: string, fromChatDetails?: boolean) => void;
};

export const GroupChannelsScreenView = React.memo(
  function GroupChannelsScreenViewComponent({
    group,
    unjoinedChannels = [],
    onChannelPressed,
    onJoinChannel,
    onBackPressed,
    onGoToGroupMembers,
    onPressManageChannels,
  }: GroupChannelsScreenViewProps) {
    useRenderCount('GroupChannelsScreenView');
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
      if (group) {
        navigateToChatDetails({ type: 'group', id: group.id });
      }
    }, [group, navigateToChatDetails]);

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
      const memberCount = group?.members?.length ?? 0;
      const privacy = group?.privacy
        ? `${capitalize(group.privacy)} group`
        : 'Group';

      if (memberCount > 0) {
        return `${privacy} with ${memberCount} ${pluralize(memberCount, 'member')}`;
      }
      return privacy;
    }, [group?.description, group?.members?.length, group?.privacy]);

    const listSectionTitleColor = getVariableValue(useTheme().secondaryText);
    const isWindowNarrow = useIsWindowNarrow();

    const sizeRefs = useRef({
      sectionHeader: isWindowNarrow ? 28 : 24.55,
      channelItem: isWindowNarrow ? 72 : 64,
    });

    const handleHeaderLayout = useCallback((e: LayoutChangeEvent) => {
      sizeRefs.current.sectionHeader = e.nativeEvent.layout.height;
    }, []);

    const handleItemLayout = useCallback((e: LayoutChangeEvent) => {
      sizeRefs.current.channelItem = e.nativeEvent.layout.height;
    }, []);

    const listItems: ChannelListData[] = useMemo(() => {
      if (!group || !group.channels || group.channels.length === 0) {
        return [];
      }

      const result: ChannelListData[] = [];

      // Add regular channels - either by section or by recency
      if (sortBy === 'recency') {
        // Sort channels by recency
        const channelsSortedByRecency = [...group.channels].sort((a, b) => {
          const aLastPostAt = a.lastPostAt || 0;
          const bLastPostAt = b.lastPostAt || 0;
          return bLastPostAt - aLastPostAt;
        });

        if (channelsSortedByRecency.length > 0) {
          result.push({
            type: 'sectionHeader',
            title: 'Recent Channels',
            id: 'recent-channels',
          });
          result.push(...channelsSortedByRecency);
        }
      } else {
        // Add sections
        group.navSections?.forEach((section) => {
          const sectionChannels = group.channels?.filter((c) =>
            section.channels?.some((sc) => sc.channelId === c.id)
          );

          if (sectionChannels && sectionChannels.length > 0) {
            result.push({
              type: 'sectionHeader',
              title: section.title ?? '',
              id: `section-${section.id}`,
            });
            // Sort section channels by their index within the section
            const sortedSectionChannels = [...sectionChannels].sort((a, b) => {
              const aIndex =
                section.channels?.find((c) => c.channelId === a.id)
                  ?.channelIndex ?? 0;
              const bIndex =
                section.channels?.find((c) => c.channelId === b.id)
                  ?.channelIndex ?? 0;
              return aIndex - bIndex;
            });
            result.push(...sortedSectionChannels);
          }
        });

        // Add ungrouped channels
        const unGroupedChannels = group.channels.filter(
          (c) =>
            !group.navSections?.some((s) =>
              s.channels?.some((sc) => sc.channelId === c.id)
            )
        );

        if (unGroupedChannels.length > 0) {
          result.push({
            type: 'sectionHeader',
            title: 'All Channels',
            id: 'all-channels',
          });
          result.push(...unGroupedChannels);
        }
      }

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
            <SectionListHeader onLayout={handleHeaderLayout}>
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
            onPress={isUnjoined ? onJoinChannel : onChannelPressed}
            onLongPress={!isUnjoined ? handleOpenChannelOptions : undefined}
            useTypeIcon={true}
            dimmed={isUnjoined}
            disableOptions={isUnjoined}
            onLayout={handleItemLayout}
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
        onJoinChannel,
        onChannelPressed,
        handleOpenChannelOptions,
        listSectionTitleColor,
        handleHeaderLayout,
        handleItemLayout,
      ]
    );

    const keyExtractor = useCallback((item: ChannelListData) => {
      return isSectionHeader(item) ? item.id : item.id;
    }, []);

    const getItemType = useCallback((item: ChannelListData) => {
      return isSectionHeader(item) ? 'sectionHeader' : 'channel';
    }, []);

    // Override layout function for FlashList
    const handleOverrideLayout = useCallback(
      (layout: { span?: number; size?: number }, item: ChannelListData) => {
        layout.size = isSectionHeader(item)
          ? sizeRefs.current.sectionHeader
          : sizeRefs.current.channelItem;
      },
      []
    );

    return (
      <View flex={1}>
        <ScreenHeader
          // When we're fetching the group from the local database, this component
          // will initially mount with group undefined, then very quickly load the
          // group in. Keeping the key consistent as long as the ID is prevents a
          // full re-render / animation triggering almost immediately after the
          // component mounts.
          key={group?.id}
          title={title}
          titleIcon={group ? <GroupAvatar model={group} size="$2xl" /> : null}
          subtitle={subtitle}
          showSubtitle={isWindowNarrow}
          borderBottom={isWindowNarrow}
          backAction={onBackPressed}
          onTitlePress={handleTitlePress}
          rightControls={
            <>
              {group && isGroupAdmin && (
                <Popover hoverable allowFlip placement="bottom-end">
                  <Popover.Trigger>
                    <ScreenHeader.IconButton
                      type="Draw"
                      aria-label="Edit channels"
                      onPress={() =>
                        group && onPressManageChannels(group.id, false)
                      }
                      disabled={!canEdit}
                    />
                  </Popover.Trigger>
                </Popover>
              )}
            </>
          }
        />
        {isPersonalGroup && group && (
          <WayfindingNotice.GroupChannels group={group} />
        )}
        {group && group.joinStatus === 'joining' ? (
          // Show loading spinner while group is syncing
          <YStack flex={1} justifyContent="center" alignItems="center">
            <LoadingSpinner />
          </YStack>
        ) : group && group.channels && group.channels.length > 0 ? (
          <YStack flex={1}>
            <SystemNotices.ConnectedJoinRequestNotice
              group={group}
              onViewRequests={onGoToGroupMembers}
            />
            <FlashList
              data={listItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              getItemType={getItemType}
              estimatedItemSize={sizeRefs.current.channelItem}
              overrideItemLayout={handleOverrideLayout}
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
