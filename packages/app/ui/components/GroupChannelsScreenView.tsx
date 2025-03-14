import * as db from '@tloncorp/shared/db';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { LoadingSpinner } from '@tloncorp/ui';
import { Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack, getVariableValue, useTheme } from 'tamagui';

import { useChatOptions, useCurrentUserId } from '../contexts';
import { useGroupTitle, useIsAdmin } from '../utils/channelUtils';
import { Badge } from './Badge';
import ChannelNavSections from './ChannelNavSections';
import { ChatOptionsSheet } from './ChatOptionsSheet';
import { ChannelListItem } from './ListItem/ChannelListItem';
import { CreateChannelSheet } from './ManageChannels/CreateChannelSheet';
import { ScreenHeader } from './ScreenHeader';

type GroupChannelsScreenViewProps = {
  group: db.Group | null;
  unjoinedChannels?: db.Channel[];
  onChannelPressed: (channel: db.Channel) => void;
  onJoinChannel: (channel: db.Channel) => void;
  onBackPressed: () => void;
};

export function GroupChannelsScreenView({
  group,
  unjoinedChannels = [],
  onChannelPressed,
  onJoinChannel,
  onBackPressed,
}: GroupChannelsScreenViewProps) {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [openChatOptions, setOpenChatOptions] = useState(false);
  const sortBy = db.channelSortPreference.useValue();
  const insets = useSafeAreaInsets();
  const userId = useCurrentUserId();
  const isGroupAdmin = useIsAdmin(group?.id ?? '', userId);

  const chatOptions = useChatOptions();
  const handlePressOverflowButton = useCallback(() => {
    if (group) {
      chatOptions.open(group.id, 'group');
    }
  }, [group, chatOptions]);

  const handleOpenChannelOptions = useCallback(
    (channel: db.Channel) => {
      if (group) {
        chatOptions.open(channel.id, 'channel');
      }
    },
    [group, chatOptions]
  );

  const title = useGroupTitle(group);

  const titleWidth = useCallback(() => {
    if (isGroupAdmin) {
      return 55;
    } else {
      return 75;
    }
  }, [isGroupAdmin]);

  const listSectionTitleColor = getVariableValue(useTheme().secondaryText);
  const isWindowNarrow = useIsWindowNarrow();

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
        titleWidth={titleWidth()}
        backAction={onBackPressed}
        rightControls={
          <>
            {isGroupAdmin && (
              <ScreenHeader.IconButton
                type="Add"
                onPress={() => setShowCreateChannel(true)}
              />
            )}
            {!isWindowNarrow && group ? (
              <ChatOptionsSheet
                open={openChatOptions}
                onOpenChange={setOpenChatOptions}
                chat={{ type: 'group', id: group.id }}
                trigger={<ScreenHeader.IconButton type="Overflow" />}
              />
            ) : (
              <ScreenHeader.IconButton
                type="Overflow"
                onPress={handlePressOverflowButton}
              />
            )}
          </>
        }
      />
      {group && group.channels && group.channels.length ? (
        <ScrollView
          contentContainerStyle={{
            gap: '$s',
            paddingTop: '$l',
            paddingHorizontal: '$l',
            paddingBottom: insets.bottom,
          }}
        >
          <ChannelNavSections
            group={group}
            channels={group.channels}
            onSelect={onChannelPressed}
            sortBy={sortBy || 'recency'}
            onLongPress={handleOpenChannelOptions}
          />

          {unjoinedChannels.length > 0 && (
            <YStack>
              <Text
                paddingHorizontal="$l"
                paddingVertical="$xl"
                fontSize="$s"
                color={listSectionTitleColor}
              >
                Available Channels
              </Text>
              {unjoinedChannels.map((channel) => (
                <ChannelListItem
                  key={channel.id}
                  model={channel}
                  onPress={() => onJoinChannel(channel)}
                  useTypeIcon={true}
                  dimmed={true}
                  EndContent={
                    <View justifyContent="center">
                      <Badge text="Join" />
                    </View>
                  }
                />
              ))}
            </YStack>
          )}
        </ScrollView>
      ) : (
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
