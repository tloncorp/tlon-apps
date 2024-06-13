import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import { GroupChannelsScreenView } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import {
  getChannelSortPreference,
  setChannelSortPreference,
} from '../lib/channelSortPreference';
import type { HomeStackParamList } from '../types';

type GroupChannelsScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'GroupChannels'
>;

export function GroupChannelsScreen({
  route,
  navigation,
}: GroupChannelsScreenProps) {
  const [sortByPreference, setSortByPrefence] = useState<
    'recency' | 'arranged'
  >(() => getChannelSortPreference());
  const groupParam = route.params.group;
  const groupQuery = store.useGroup({ id: groupParam.id });
  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      navigation.navigate('Channel', {
        channel: channel,
      });
    },
    [navigation]
  );
  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSortByChanged = useCallback(
    (newSortBy: 'recency' | 'arranged') => {
      setSortByPrefence(newSortBy);
      setChannelSortPreference(newSortBy);
    },
    []
  );

  return (
    <GroupChannelsScreenView
      onChannelPressed={handleChannelSelected}
      onBackPressed={handleGoBackPressed}
      group={groupQuery.data ?? route.params.group}
      channels={groupQuery.data?.channels ?? route.params.group.channels}
      sortBy={sortByPreference}
      setSortBy={handleSortByChanged}
    />
  );
}
