import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View } from 'tamagui';

import { useChatOptions } from '../contexts/chatOptions';
import ChannelNavSections from './ChannelNavSections';
import { ChatOptionsSheet, ChatOptionsSheetMethods } from './ChatOptionsSheet';
import {
  ChannelTypeName,
  CreateChannelSheet,
} from './ManageChannels/CreateChannelSheet';
import { ScreenHeader } from './ScreenHeader';

type GroupChannelsScreenViewProps = {
  onChannelPressed: (channel: db.Channel) => void;
  onBackPressed: () => void;
  currentUser: string;
  createChannel: ({
    title,
    description,
    channelType,
  }: {
    title: string;
    description: string;
    channelType: ChannelTypeName;
  }) => Promise<void>;
};

export function GroupChannelsScreenView({
  onChannelPressed,
  onBackPressed,
  createChannel,
}: GroupChannelsScreenViewProps) {
  const groupOptions = useChatOptions();
  const group = groupOptions?.group;
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [sortBy, setSortBy] = useState<db.ChannelSortPreference>('recency');
  const insets = useSafeAreaInsets();

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
        backAction={onBackPressed}
        rightControls={
          <>
            <ScreenHeader.IconButton
              type="Add"
              onPress={() => setShowCreateChannel(true)}
            />
            <ScreenHeader.IconButton
              type="Overflow"
              onPress={handlePressOverflowButton}
            />
          </>
        }
      />
      <ScrollView
        contentContainerStyle={{
          gap: '$s',
          paddingTop: '$l',
          paddingHorizontal: '$l',
          paddingBottom: insets.bottom,
        }}
      >
        {group && groupOptions.groupChannels ? (
          <ChannelNavSections
            group={group}
            channels={groupOptions.groupChannels}
            onSelect={onChannelPressed}
            sortBy={sortBy || 'recency'}
            onLongPress={handleOpenChannelOptions}
          />
        ) : null}
      </ScrollView>

      {showCreateChannel && (
        <CreateChannelSheet
          onOpenChange={(open) => setShowCreateChannel(open)}
          createChannel={async ({ title, description, channelType }) =>
            createChannel({
              title,
              description,
              channelType,
            })
          }
        />
      )}
      <ChatOptionsSheet ref={chatOptionsSheetRef} setSortBy={setSortBy} />
    </View>
  );
}
