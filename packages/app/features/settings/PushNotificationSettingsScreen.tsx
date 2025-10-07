import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { ComponentProps, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { RootStackParamList } from '../../navigation/types';
import {
  ChannelListItem,
  ChatOptionsProvider,
  GroupListItem,
  ListItem,
  RadioInput,
  RadioInputOption,
  ScreenHeader,
  ScrollView,
  TlonText,
  View,
  YStack,
  useIsWindowNarrow,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function PushNotificationSettingsScreen({ navigation }: Props) {
  const baseVolumeSetting = store.useBaseVolumeLevel();
  const { data: exceptions } = store.useVolumeExceptions();
  const isWindowNarrow = useIsWindowNarrow();
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

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

  const notificationOptions: RadioInputOption<ub.NotificationLevel>[] =
    useMemo(() => {
      return [
        {
          title: 'All group activity',
          value: 'medium' as ub.NotificationLevel,
          description:
            'Notify for all posts, mentions, and replies in groups. Direct messages always notify unless muted.',
        },
        {
          title: 'Mentions and replies only',
          value: 'soft' as ub.NotificationLevel,
          description:
            'Notify only when someone mentions you or replies to your posts. Direct messages always notify unless muted.',
        },
        {
          title: 'Nothing',
          value: 'hush' as ub.NotificationLevel,
          description: isNative
            ? 'No notifications for anything, even if push notifications are enabled on your device.'
            : 'No notifications for anything.',
        },
      ];
    }, [isNative]);

  const insets = useSafeAreaInsets();

  return (
    <ChatOptionsProvider {...useChatSettingsNavigation()}>
      <View
        flex={1}
        paddingBottom={insets.bottom}
        backgroundColor="$background"
      >
        <ScreenHeader
          title="Notifications"
          backAction={() => navigation.goBack()}
        />
        <ScrollView flex={1} paddingHorizontal={'$2xl'}>
          <TlonText.Text size={'$label/m'} marginVertical={'$l'}>
            Configure what kinds of messages will send you
            {isNative ? ` device push notifications and ` : ' '}in-app alerts.
          </TlonText.Text>
          <RadioInput
            options={notificationOptions}
            value={baseVolumeSetting}
            onChange={setLevel}
            paddingRight={isWindowNarrow ? '$4xl' : undefined}
          />
          {numExceptions > 0 ? (
            <ExceptionsDisplay
              channels={exceptions?.channels ?? []}
              groups={exceptions?.groups ?? []}
              removeException={removeException}
            />
          ) : null}
        </ScrollView>
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
  return (
    <YStack marginTop={'$l'} flex={1} {...rest}>
      <TlonText.Text size={'$label/2xl'} marginBottom={'$l'}>
        Overrides
      </TlonText.Text>
      <TlonText.Text size={'$label/m'} marginBottom={'$xl'}>
        These groups, channels, and DMs have custom notification settings. Tap
        the &quot;X&quot; to remove the override and return to the default
        setting.
      </TlonText.Text>
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
            paddingVertical="$xs"
            paddingHorizontal={0}
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
            paddingVertical={'$xs'}
            paddingHorizontal={0}
            disableOptions
          />
        );
      })}
    </YStack>
  );
}
