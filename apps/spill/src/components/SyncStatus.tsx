import React, {useCallback, useMemo} from 'react';
import {FlatList, ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as db from '@db';
import {formatTime} from '@utils/format';
import {useSync} from '../utils/sync';
import {Button, SizableText, XStack, YStack} from '@ochre';
import {styled} from 'tamagui';

function SyncStatus() {
  const channels = db.useQuery(
    'Channel',
    c => {
      return c
        .filtered('unreadState != null')
        .sorted('unreadState.updatedAt', true);
    },
    [],
  );

  const getItemKey = useCallback((item: db.Channel) => item.id, []);
  const renderItem = useCallback(({item}: {item: db.Channel}) => {
    return <SyncStatusItem key={item.id} channel={item} />;
  }, []);

  const realm = db.useRealm();

  const handlePressClearCache = useCallback(() => {
    realm.write(() => {
      realm.delete(realm.objects('Channel'));
      realm.delete(realm.objects('Post'));
      realm.delete(realm.objects('Group'));
    });
  }, [realm]);

  const {sync} = useSync();
  const handlePressSync = useCallback(() => {
    sync();
  }, [sync]);

  const safeAreaInsets = useSafeAreaInsets();

  const flatListStyles: ViewStyle = useMemo(
    () => ({
      height: 300,
      borderBottomWidth: 1,
      borderColor: 'black',
      borderTopWidth: 1,
    }),
    [],
  );

  return (
    <YStack
      borderColor={'$color'}
      borderTopWidth={1}
      flex={1}
      paddingBottom={safeAreaInsets.bottom}>
      <XStack
        justifyContent="space-between"
        gap="$s"
        paddingHorizontal="$m"
        width="100%">
        <SizableText flex={1.3} numberOfLines={1}>
          Channel
        </SizableText>
        <SizableText flex={0.5}>Posts</SizableText>
        <SizableText flex={0.5}>Synced</SizableText>
        <SizableText flex={0.5}>Newest</SizableText>
      </XStack>
      <FlatList
        style={flatListStyles}
        data={channels}
        keyExtractor={getItemKey}
        renderItem={renderItem}
        viewabilityConfig={{
          waitForInteraction: true,
          viewAreaCoveragePercentThreshold: 95,
        }}
      />
      <XStack padding="$s" paddingHorizontal="$m">
        <Button flex={1} onPress={handlePressSync}>
          <Button.Text>Sync now</Button.Text>
        </Button>
        <Button onPress={handlePressClearCache} flex={1}>
          <Button.Text>Clear Cache</Button.Text>
        </Button>
      </XStack>
    </YStack>
  );
}

export default SyncStatus;

const SyncStatusItem = React.memo(function SyncStatusItem({
  channel,
}: {
  channel: db.Channel;
}) {
  return (
    <SyncStatusItemFrame key={channel.id}>
      <XStack justifyContent="space-between" gap="$s" width="100%">
        <SizableText flex={1.3} numberOfLines={1}>
          {channel.group?.title} – {channel.title}
        </SizableText>
        <SizableText flex={0.5}>{channel.posts?.length}</SizableText>
        <SizableText flex={0.5} numberOfLines={1}>
          {channel.syncedAt && formatTime(channel.syncedAt)}
        </SizableText>
        <SizableText flex={0.5} numberOfLines={1}>
          {/* {formatTime(mostRecentTime)} */}
        </SizableText>
      </XStack>
    </SyncStatusItemFrame>
  );
});

const SyncStatusItemFrame = styled(YStack, {
  paddingHorizontal: 10,
});
