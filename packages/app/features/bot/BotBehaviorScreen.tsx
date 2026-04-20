import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { saveBotConfig } from '@tloncorp/shared/api';
import type { BotConfig } from '@tloncorp/shared/domain';
import { useCallback, useState } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { BotBehaviorScreenView } from '../../ui/components/BotBehaviorScreenView';
import type { BotBehaviorFormData } from '../../ui/components/BotBehaviorScreenView';

type Props = NativeStackScreenProps<RootStackParamList, 'BotBehavior'>;

export function BotBehaviorScreen({ navigation, route }: Props) {
  const { name, emoji, avatarUrl, personalityType, customSoulPrompt } =
    route.params;
  const [isSaving, setIsSaving] = useState(false);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSave = useCallback(
    async (data: BotBehaviorFormData) => {
      setIsSaving(true);
      try {
        const config: BotConfig = {
          name,
          emoji,
          avatarUrl,
          personalityType,
          customSoulPrompt,
          model: data.model,
          apiKey: data.apiKey || undefined,
          responseStyle: data.responseStyle,
          activeHoursStart: Number(data.activeHoursStart),
          activeHoursEnd: Number(data.activeHoursEnd),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        await saveBotConfig(config);
        // Go back to settings after saving
        navigation.popToTop();
      } catch (error) {
        console.error('Failed to save bot config:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [name, emoji, personalityType, customSoulPrompt, navigation]
  );

  return (
    <BotBehaviorScreenView
      onGoBack={handleGoBack}
      onSave={handleSave}
      isSaving={isSaving}
    />
  );
}
