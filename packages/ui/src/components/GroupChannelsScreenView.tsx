import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View } from 'tamagui';

import { useChatOptions } from '../contexts/chatOptions';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import ChannelNavSections from './ChannelNavSections';
import { ChatOptionsSheet, ChatOptionsSheetMethods } from './ChatOptionsSheet';
import { GenericHeader } from './GenericHeader';
import { Icon } from './Icon';

const ChannelSortOptions = ({
  setShowSortOptions,
}: {
  setShowSortOptions: (show: boolean) => void;
}) => {
  return (
    <Button borderWidth={0} onPress={() => setShowSortOptions(true)}>
      <Icon type="Filter" />
    </Button>
  );
};

type GroupChannelsScreenViewProps = {
  onChannelPressed: (channel: db.Channel) => void;
  onBackPressed: () => void;
  currentUser: string;
};

export function GroupChannelsScreenView({
  onChannelPressed,
  onBackPressed,
}: GroupChannelsScreenViewProps) {
  const groupOptions = useChatOptions();
  const group = groupOptions?.group;
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);

  const [showSortOptions, setShowSortOptions] = useState(false);
  const [sortBy, setSortBy] = useState<db.ChannelSortPreference>('recency');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const getSortByPreference = async () => {
      const preference = await db.getChannelSortPreference();
      setSortBy(preference ?? 'recency');
    };

    getSortByPreference();
  }, [setSortBy]);

  const handleSortByChanged = useCallback(
    (newSortBy: 'recency' | 'arranged') => {
      setSortBy(newSortBy);
      db.storeChannelSortPreference(newSortBy);
    },
    []
  );

  const handlePressOverflowButton = useCallback(() => {
    if (group) {
      chatOptionsSheetRef.current?.open(group.id, 'group');
    }
  }, [group]);

  return (
    <View flex={1}>
      <GenericHeader
        title={group ? group?.title ?? 'Untitled' : ''}
        goBack={onBackPressed}
        rightContent={
          <View flexDirection="row" gap="$s">
            <ChannelSortOptions setShowSortOptions={setShowSortOptions} />
            <Button borderWidth={0} onPress={handlePressOverflowButton}>
              <Icon type="Overflow" />
            </Button>
          </View>
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
            sortBy={sortBy}
          />
        ) : null}
      </ScrollView>
      <ActionSheet open={showSortOptions} onOpenChange={setShowSortOptions}>
        <ActionSheet.Action
          action={() => {
            handleSortByChanged('recency');
            setShowSortOptions(false);
          }}
          primary={sortBy === 'recency'}
        >
          <ActionSheet.ActionTitle>Sort by recency</ActionSheet.ActionTitle>
        </ActionSheet.Action>
        <ActionSheet.Action
          action={() => {
            handleSortByChanged('arranged');
            setShowSortOptions(false);
          }}
          primary={sortBy === 'arranged'}
        >
          <ActionSheet.ActionTitle>Sort by arrangement</ActionSheet.ActionTitle>
        </ActionSheet.Action>
      </ActionSheet>
      <ChatOptionsSheet ref={chatOptionsSheetRef} />
    </View>
  );
}
