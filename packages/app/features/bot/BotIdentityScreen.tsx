import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { BotIdentityScreenView } from '../../ui/components/BotIdentityScreenView';
import type { BotIdentityFormData } from '../../ui/components/BotIdentityScreenView';

type Props = NativeStackScreenProps<RootStackParamList, 'BotIdentity'>;

export function BotIdentityScreen({ navigation }: Props) {
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleContinue = useCallback(
    (data: BotIdentityFormData) => {
      navigation.navigate('BotBehavior', {
        name: data.name,
        emoji: data.emoji,
        personalityType: data.personalityType,
        customSoulPrompt: data.customSoulPrompt,
      });
    },
    [navigation]
  );

  return (
    <BotIdentityScreenView
      onGoBack={handleGoBack}
      onContinue={handleContinue}
    />
  );
}
