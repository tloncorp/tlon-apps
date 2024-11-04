import * as db from '@tloncorp/shared/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, YStack } from 'tamagui';

import { useCurrentUserId } from '../contexts';
import useIsWindowNarrow from '../hooks/useIsWindowNarrow';
import { useIsAdmin } from '../utils/channelUtils';
import ChannelNavSections from './ChannelNavSections';
import { ChatOptionsSheet, ChatOptionsSheetMethods } from './ChatOptionsSheet';
import { LoadingSpinner } from './LoadingSpinner';
import { CreateChannelSheet } from './ManageChannels/CreateChannelSheet';
import { ScreenHeader } from './ScreenHeader';

type GroupChannelsScreenViewProps = {
  group: db.Group | null;
  onChannelPressed: (channel: db.Channel) => void;
  onBackPressed: () => void;
  enableCustomChannels?: boolean;
};

export function GroupChannelsScreenView({
  group,
  onChannelPressed,
  onBackPressed,
  enableCustomChannels = false,
}: GroupChannelsScreenViewProps) {
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [sortBy, setSortBy] = useState<db.ChannelSortPreference>('recency');
  const insets = useSafeAreaInsets();
  const userId = useCurrentUserId();
  const isGroupAdmin = useIsAdmin(group?.id ?? '', userId);

  useEffect(() => {
    const getSortByPreference = async () => {
      const preference = await db.getChannelSortPreference();
      setSortBy(preference ?? 'recency');
    };

    getSortByPreference();
  }, [setSortBy]);

  const handlePressOverflowButton = useCallback(() => {
    if (group) {
      chatOptionsSheetRef.current?.open(group.id, 'group');
    }
  }, [group]);

  const title = group ? group?.title ?? 'Untitled' : '';

  const handleOpenChannelOptions = useCallback(
    (channel: db.Channel) => {
      if (group) {
        chatOptionsSheetRef.current?.open(channel.id, channel.type);
      }
    },
    [group]
  );

  const titleWidth = useCallback(() => {
    if (isGroupAdmin) {
      return 55;
    } else {
      return 75;
    }
  }, [isGroupAdmin]);

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
            <ScreenHeader.IconButton
              type="Overflow"
              onPress={handlePressOverflowButton}
            />
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
            onLongPress={isWindowNarrow ? handleOpenChannelOptions : undefined}
          />
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
          enableCustomChannels={enableCustomChannels}
        />
      )}
      <ChatOptionsSheet ref={chatOptionsSheetRef} setSortBy={setSortBy} />
    </View>
  );
}
