import * as db from '@tloncorp/shared/dist/db';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScrollView, View } from '../core';
import { ActionSheet } from './ActionSheet';
import { Button } from './Button';
import { GenericHeader } from './Channel/ChannelHeader';
import ChannelNavSections from './ChannelNavSections';
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

export function GroupChannelsScreenView({
  group,
  channels,
  onChannelPressed,
  onBackPressed,
}: {
  group: db.Group | undefined | null;
  channels: db.Channel[] | undefined | null;
  onChannelPressed: (channel: db.Channel) => void;
  onBackPressed: () => void;
}) {
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

  return (
    <View flex={1}>
      <GenericHeader
        title={group ? group?.title ?? 'Untitled' : ''}
        goBack={onBackPressed}
        rightContent={
          <ChannelSortOptions setShowSortOptions={setShowSortOptions} />
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
        {group && channels ? (
          <ChannelNavSections
            group={group}
            channels={channels}
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
    </View>
  );
}
