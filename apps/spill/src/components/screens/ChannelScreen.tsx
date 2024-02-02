import {LivePostList} from '@components/ObjectList';
import * as db from '@db';
import {Input, Stack} from '@ochre';
import React, {useMemo} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationScreenProps, useScreenHeight} from '../../utils/navigation';

export function ChannelScreen({route}: NavigationScreenProps<'Channel'>) {
  const {channelId, highlightedPostId} = route.params;
  const safeAreaInsets = useSafeAreaInsets();

  const settings: db.TabSettings = useMemo(
    () => ({
      ...db.TabSettings.default(),
      query: {
        inChannels: [{id: channelId}],
        groupBy: 'post',
      },
    }),
    [channelId],
  );

  return (
    <Stack height={useScreenHeight()} backgroundColor={'$background'}>
      <LivePostList
        highlightedPostId={highlightedPostId}
        isInverted={true}
        settings={settings}
      />
      <Stack
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        paddingBottom={safeAreaInsets.bottom + 10}
        paddingHorizontal="$xs"
        backgroundColor="transparent">
        <Input placeholder="Message" />
      </Stack>
    </Stack>
  );
}
