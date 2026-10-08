import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ub from '@tloncorp/api/urbit';
import {
  AnalyticsEvent,
  configurationFromChannel,
  trackEvent,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { isWeb } from 'tamagui';

import { useBrowserNotificationPermission } from '../../hooks/useBrowserNotificationPermission';
import { RootStackParamList } from '../../navigation/types';
import {
  ChannelAvatar,
  GroupAvatar,
  getChannelTitle,
  getGroupTitle,
  useCalm,
  useNotificationLevelOptions,
} from '../../ui';
import {
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
} from '../../ui/components/SettingsList';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'PushNotificationSettings'
>;

export function PushNotificationSettingsScreen({ navigation }: Props) {
  const baseVolumeSetting = store.useBaseVolumeLevel();
  const { data: exceptions } = store.useVolumeExceptions();
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  const browserNotifications = useBrowserNotificationPermission();
  const levelOptions = useNotificationLevelOptions();
  const { disableNicknames } = useCalm();

  const browserPermissionLabel = useMemo(() => {
    switch (browserNotifications.permission) {
      case 'granted':
        return 'Enabled';
      case 'denied':
        return 'Blocked in browser';
      case 'default':
        return 'Not enabled';
      default:
        return 'Unsupported';
    }
  }, [browserNotifications.permission]);

  const setLevel = useCallback(
    async (level: ub.NotificationLevel) => {
      if (level === baseVolumeSetting) return;
      await store.setBaseVolumeLevel({ level });
      trackEvent(AnalyticsEvent.NotificationPreferenceChanged, {
        setting: 'default_level',
        value: level,
      });
    },
    [baseVolumeSetting]
  );

  const removeException = useCallback(
    async (exception: db.Group | db.Channel) => {
      const didRemove = db.isGroup(exception)
        ? await store.setGroupVolumeLevel({ group: exception, level: null })
        : await store.setChannelVolumeLevel({
            channel: exception,
            level: null,
          });
      if (!didRemove) return;

      trackEvent(AnalyticsEvent.NotificationPreferenceChanged, {
        setting: 'override_removed',
        value: db.isGroup(exception) ? 'group' : 'channel',
      });
    },
    []
  );

  // Removing an override can't be undone from here, so it asks first.
  const confirmRemoveException = useCallback(
    (exception: db.Group | db.Channel, title: string) => {
      const message = `Notifications for ${title} will follow your default setting again.`;
      if (isWeb) {
        if (window.confirm(`Remove this override? ${message}`)) {
          removeException(exception);
        }
        return;
      }
      Alert.alert('Remove this override?', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeException(exception),
        },
      ]);
    },
    [removeException]
  );

  const sections = useMemo<SettingsSectionModel[]>(() => {
    const overrideRows: SettingsRowModel[] = [
      ...(exceptions?.groups ?? []).map((group): SettingsRowModel => {
        const title = getGroupTitle(group, disableNicknames);
        return {
          key: group.id,
          title,
          value: group.volumeSettings?.level
            ? ub.NotificationNamesShort[group.volumeSettings.level]
            : undefined,
          leading: {
            kind: 'element',
            render: ({ size }) => (
              <GroupAvatar
                model={group}
                size="custom"
                width={size}
                height={size}
              />
            ),
          },
          accessory: 'none',
          onPress: () => confirmRemoveException(group, title),
        };
      }),
      ...(exceptions?.channels ?? []).map((channel): SettingsRowModel => {
        const title =
          getChannelTitle({
            ...configurationFromChannel(channel),
            channelTitle: channel.title,
            members: channel.members,
            disableNicknames,
          }) ?? channel.id;
        return {
          key: channel.id,
          title,
          value: channel.volumeSettings?.level
            ? ub.NotificationNamesShort[channel.volumeSettings.level]
            : undefined,
          leading: {
            kind: 'element',
            render: ({ size }) => (
              <ChannelAvatar
                model={channel}
                size="custom"
                width={size}
                height={size}
              />
            ),
          },
          accessory: 'none',
          onPress: () => confirmRemoveException(channel, title),
        };
      }),
    ];

    return [
      {
        key: 'level',
        footer: `Configure what kinds of messages will send you${
          isNative ? ' device push notifications and' : ''
        } in-app alerts.`,
        rows: levelOptions.map((option) => ({
          key: option.value,
          title: option.title,
          subtitle: option.description,
          selected: option.value === baseVolumeSetting,
          onPress: () => setLevel(option.value),
        })),
      },
      ...(browserNotifications.isSupported
        ? [
            {
              key: 'browser',
              rows: [
                {
                  key: 'browser-permission',
                  title: 'Browser notifications',
                  value: browserPermissionLabel,
                },
                ...(browserNotifications.canRequestPermission
                  ? [
                      {
                        key: 'browser-enable',
                        title: 'Enable',
                        action: true,
                        onPress: browserNotifications.requestPermission,
                      },
                    ]
                  : []),
              ],
            },
          ]
        : []),
      ...(overrideRows.length > 0
        ? [
            {
              key: 'overrides',
              title: 'Overrides',
              footer: `These groups, channels, and DMs have custom notification settings. ${
                isNative ? 'Tap' : 'Click'
              } one to remove its override and return to the setting above.`,
              rows: overrideRows,
            },
          ]
        : []),
    ];
  }, [
    baseVolumeSetting,
    browserNotifications.canRequestPermission,
    browserNotifications.isSupported,
    browserNotifications.requestPermission,
    browserPermissionLabel,
    confirmRemoveException,
    disableNicknames,
    exceptions,
    isNative,
    levelOptions,
    setLevel,
  ]);

  return (
    <SettingsListScreenView
      title="Notifications"
      sections={sections}
      onBackPressed={() => navigation.goBack()}
    />
  );
}
