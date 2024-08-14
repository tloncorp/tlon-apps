import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import {
  ChannelListItem,
  GenericHeader,
  GroupListItem,
  Icon,
  ListItem,
  ScrollView,
  SizableText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { ComponentProps, useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function PushNotificationSettingsScreen(props: Props) {
  const baseVolumeSetting = store.useBaseVolumeLevel();
  const { data: exceptions } = store.useVolumeExceptions();

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
    <View flex={1}>
      <GenericHeader
        title="Push Notifications"
        goBack={() => props.navigation.goBack()}
      />
      <ScrollView marginTop="$m" marginHorizontal="$2xl" flex={1}>
        <SizableText marginLeft="$m" marginTop="$xl" size="$m">
          Configure what kinds of messages will send you notifications.
        </SizableText>

        <YStack marginLeft="$m" marginTop="$3xl">
          <XStack onPress={() => setLevel('medium')}>
            <LevelIndicator levels={['loud', 'medium']} />
            <SizableText marginLeft="$l">All group activity</SizableText>
          </XStack>

          <XStack marginTop="$xl" onPress={() => setLevel('soft')}>
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

          <XStack marginTop="$xl" onPress={() => setLevel('hush')}>
            <LevelIndicator levels={['hush']} />
            <SizableText marginLeft="$l">Nothing</SizableText>
          </XStack>
        </YStack>

        <ExceptionsDisplay
          marginTop="$2xl"
          marginHorizontal="$xl"
          channels={exceptions?.channels ?? []}
          groups={exceptions?.groups ?? []}
          removeException={removeException}
        />
      </ScrollView>
    </View>
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
  return (
    <YStack {...rest}>
      <SizableText color="$secondaryText">Exceptions</SizableText>
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
          />
        );
      })}
    </YStack>
  );
}
