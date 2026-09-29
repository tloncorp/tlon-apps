import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback } from 'react';
import { View } from 'tamagui';

import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader } from '../../ui';
import { SettingsList } from '../../ui/components/SettingsList';
import {
  BotSettingsApplyBar,
  BotSettingsNavigate,
  type BotSettingsSectionModels,
  useBotSettingsHub,
  useBotSettingsSectionModels,
} from './bot/BotSettingsSections';

type Area = Exclude<keyof BotSettingsSectionModels, 'overview'>;

const areaTitles: Record<Area, string> = {
  models: 'Models',
  connections: 'Connections',
};

/**
 * One area of the bot's settings, opened from its summary row on the bot's
 * card. Edits join the same shared draft, so the apply bar here and on the
 * Settings tab always agree.
 */
function BotSettingsAreaScreen({
  area,
  navigation,
}: {
  area: Area;
  navigation: {
    goBack: () => void;
    navigate: unknown;
  };
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const hub = useBotSettingsHub();
  const sections = useBotSettingsSectionModels(
    hub,
    navigation.navigate as BotSettingsNavigate
  )[area];
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        title={areaTitles[area]}
        backAction={isWindowNarrow ? handleBack : undefined}
        placement="navigation"
      />
      <View flex={1}>
        <SettingsList sections={sections} />
      </View>
      <BotSettingsApplyBar hub={hub} />
    </View>
  );
}

export function BotModelsScreen(
  props: NativeStackScreenProps<RootStackParamList, 'BotModels'>
) {
  return <BotSettingsAreaScreen area="models" navigation={props.navigation} />;
}

export function BotConnectionsScreen(
  props: NativeStackScreenProps<RootStackParamList, 'BotConnections'>
) {
  return (
    <BotSettingsAreaScreen area="connections" navigation={props.navigation} />
  );
}
