import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View } from 'tamagui';

import { useGroupOptions } from '../contexts/groupOptions';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import ChannelNavSections from './ChannelNavSections';
import { ChatOptionsSheet } from './ChatOptionsSheet';
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
  currentUser,
}: GroupChannelsScreenViewProps) {
  const groupOptions = useGroupOptions();
  const group = groupOptions?.group;

  const [showChatOptions, setShowChatOptions] = useState(false);
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

  const handleChatOptionsOpenChange = useCallback((open: boolean) => {
    setShowChatOptions(open);
  }, []);

  const handleAction = useCallback((action: () => void) => {
    setShowChatOptions(false);
    action();
  }, []);

  return (
    <View flex={1}>
      <GenericHeader
        title={group ? group?.title ?? 'Untitled' : ''}
        goBack={onBackPressed}
        rightContent={
          <View flexDirection="row" gap="$s">
            <ChannelSortOptions setShowSortOptions={setShowSortOptions} />
            <Button borderWidth={0} onPress={() => setShowChatOptions(true)}>
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
      {groupOptions && (
        <ChatOptionsSheet
          open={showChatOptions}
          onOpenChange={handleChatOptionsOpenChange}
          currentUser={currentUser}
          pinned={groupOptions.pinned}
          group={group!}
          useGroup={groupOptions.useGroup}
          onPressGroupMeta={groupOptions.onPressGroupMeta}
          onPressGroupMembers={groupOptions.onPressGroupMembers}
          onPressManageChannels={groupOptions.onPressManageChannels}
          onPressInvitesAndPrivacy={groupOptions.onPressInvitesAndPrivacy}
          onPressRoles={groupOptions.onPressRoles}
          onPressLeave={groupOptions.onPressLeave}
          onTogglePinned={groupOptions.onTogglePinned}
        />
      )}
    </View>
  );
}
