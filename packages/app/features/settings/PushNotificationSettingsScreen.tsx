import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { ComponentProps, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { RootStackParamList } from '../../navigation/types';
import {
  ChannelListItem,
  ChatOptionsProvider,
  GroupListItem,
  Icon,
  ListItem,
  Pressable,
  ScreenHeader,
  ScrollView,
  SizableText,
  View,
  XStack,
  YStack,
  useIsWindowNarrow,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function PushNotificationSettingsScreen({ navigation }: Props) {
  const baseVolumeSetting = store.useBaseVolumeLevel();
  const { data: exceptions } = store.useVolumeExceptions();
  const isWindowNarrow = useIsWindowNarrow();

  const numExceptions = useMemo(
    () => (exceptions?.channels.length ?? 0) + (exceptions?.groups.length ?? 0),
    [exceptions]
  );

  const setLevel = useCallback(
    async (level: ub.NotificationLevel) => {
      if (level === baseVolumeSetting) return;
      await store.setBaseVolumeLevel({ level });
    },
    [baseVolumeSetting]
  );

  const removeException = useCallback(
    async (exception: db.Group | db.Channel) => {
      if (logic.isGroup(exception)) {
        await store.setGroupVolumeLevel({ group: exception, level: null });
      } else {
        await store.setChannelVolumeLevel({ channel: exception, level: null });
      }
    },
    []
  );

  const LevelIndicator = useCallback(
    (props: { levels: ub.NotificationLevel[] }) => {
      if (props.levels.includes(baseVolumeSetting)) {
        return (
          <View
            height="$2xl"
            width="$2xl"
            justifyContent="center"
            alignItems="center"
          >
            <Icon type="Checkmark" />
          </View>
        );
      }

      return (
        <View
          borderRadius="$4xl"
          borderWidth={1}
          borderColor="$secondaryBorder"
          height="$2xl"
          width="$2xl"
        />
      );
    },
    [baseVolumeSetting]
  );

  return (
    <ChatOptionsProvider {...useChatSettingsNavigation()}>
      <View flex={1} backgroundColor="$background">
        <ScreenHeader
          title="Push Notifications"
          backAction={() => navigation.goBack()}
        />
        <View
          marginTop="$m"
          marginHorizontal={isWindowNarrow ? '$2xl' : 'auto'}
          width="100%"
          maxWidth={600}
          flex={1}
        >
          <SizableText marginLeft="$m" marginTop="$xl" size="$m">
            Configure what kinds of messages will send you notifications.
          </SizableText>

          <YStack marginLeft="$m" marginTop="$3xl">
            <Pressable onPress={() => setLevel('medium')}>
              <XStack>
                <LevelIndicator levels={['loud', 'medium']} />
                <SizableText marginLeft="$l">All group activity</SizableText>
              </XStack>
            </Pressable>

            <Pressable marginTop="$xl" onPress={() => setLevel('soft')}>
              <XStack>
                <LevelIndicator levels={['soft', 'default']} />
                <YStack marginLeft="$l">
                  <SizableText>Mentions and replies only</SizableText>
                  <SizableText
                    width="80%"
                    marginTop="$m"
                    size="$s"
                    color="$secondaryText"
                  >
                    Direct messages will still notify unless you mute them.
                  </SizableText>
                </YStack>
              </XStack>
            </Pressable>

            <Pressable marginTop="$xl" onPress={() => setLevel('hush')}>
              <XStack>
                <LevelIndicator levels={['hush']} />
                <SizableText marginLeft="$l">Nothing</SizableText>
              </XStack>
            </Pressable>
          </YStack>

          {numExceptions > 0 ? (
            <ExceptionsDisplay
              marginTop="$2xl"
              channels={exceptions?.channels ?? []}
              groups={exceptions?.groups ?? []}
              removeException={removeException}
            />
          ) : null}
        </View>
      </View>
    </ChatOptionsProvider>
  );
}

export function ExceptionsDisplay({
  groups,
  channels,
  removeException,
  ...rest
}: {
  groups: db.Group[];
  channels: db.Channel[];
  removeException: (exception: db.Group | db.Channel) => void;
} & ComponentProps<typeof YStack>) {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} {...rest}>
      <SizableText
        marginHorizontal="$l"
        marginBottom="$m"
        color="$secondaryText"
      >
        Exceptions
      </SizableText>
      <ScrollView flex={1}>
        {groups.map((group) => {
          return (
            <GroupListItem
              model={group}
              key={group.id}
              pressStyle={{ backgroundColor: '$background' }}
              customSubtitle={
                group.volumeSettings?.level
                  ? ub.NotificationNamesShort[group.volumeSettings.level]
                  : undefined
              }
              EndContent={
                <ListItem.SystemIcon
                  icon="Close"
                  backgroundColor="unset"
                  onPress={() => removeException(group)}
                />
              }
              paddingVertical="$s"
              disableOptions
            />
          );
        })}
        {channels.map((channel) => {
          return (
            <ChannelListItem
              model={channel}
              key={channel.id}
              pressStyle={{ backgroundColor: '$background' }}
              customSubtitle={
                channel.volumeSettings?.level
                  ? ub.NotificationNamesShort[channel.volumeSettings.level]
                  : undefined
              }
              EndContent={
                <ListItem.SystemIcon
                  icon="Close"
                  backgroundColor="unset"
                  onPress={() => removeException(channel)}
                />
              }
              paddingVertical="$s"
              disableOptions
            />
          );
        })}
        {/* applying padding to the scrollview doesn't work, so use a spacer view */}
        <View paddingBottom={insets.bottom} />
      </ScrollView>
    </YStack>
  );
}
