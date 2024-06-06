import * as db from '@tloncorp/shared/dist/db';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScrollView, View } from '../core';
import { GenericHeader } from './Channel/ChannelHeader';
import ChannelNavSections from './ChannelNavSections';

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
  const insets = useSafeAreaInsets();

  return (
    <View flex={1}>
      <GenericHeader
        title={group ? group?.title ?? 'Untitled' : ''}
        goBack={onBackPressed}
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
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
