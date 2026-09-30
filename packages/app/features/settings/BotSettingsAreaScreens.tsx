import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { SettingsListScreenView } from '../../ui/components/SettingsList';
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
  const hub = useBotSettingsHub();
  const sections = useBotSettingsSectionModels(
    hub,
    navigation.navigate as BotSettingsNavigate
  )[area];
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SettingsListScreenView
      title={areaTitles[area]}
      sections={sections}
      onBackPressed={handleBack}
      bottomBar={<BotSettingsApplyBar hub={hub} />}
    />
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
