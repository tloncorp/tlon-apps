import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import {
  GenericHeader,
  Icon,
  SizableText,
  View,
  XStack,
  YStack,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function PushNotificationSettingsScreen(props: Props) {
  const { data: pushNotificationsSetting } =
    store.usePushNotificationsSetting();

  const setLevel = useCallback(
    async (level: ub.PushNotificationsSetting) => {
      if (level === pushNotificationsSetting) return;
      await store.setDefaultNotificationLevel(level);
    },
    [pushNotificationsSetting]
  );

  const LevelIndicator = useCallback(
    (props: { level: ub.PushNotificationsSetting }) => {
      if (pushNotificationsSetting === props.level) {
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
    [pushNotificationsSetting]
  );

  return (
    <View>
      <GenericHeader
        title="Push Notifications"
        goBack={() => props.navigation.goBack()}
      />
      <View marginTop="$m" marginHorizontal="$2xl">
        <SizableText marginLeft="$m" marginTop="$xl" size="$m">
          Configure what kinds of messages will send you notifications.
        </SizableText>

        <YStack marginLeft="$m" marginTop="$3xl">
          <XStack onPress={() => setLevel('all')}>
            <LevelIndicator level="all" />
            <SizableText marginLeft="$l">All group activity</SizableText>
          </XStack>

          <XStack marginTop="$xl" onPress={() => setLevel('some')}>
            <LevelIndicator level="some" />
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

          <XStack marginTop="$xl" onPress={() => setLevel('none')}>
            <LevelIndicator level="none" />
            <SizableText marginLeft="$l">Nothing</SizableText>
          </XStack>
        </YStack>
      </View>
    </View>
  );
}
