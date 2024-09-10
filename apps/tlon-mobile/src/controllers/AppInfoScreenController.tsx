import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInfoScreen } from '@tloncorp/app/features/settings/AppInfoScreen';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AppInfo'>;

export function AppInfoScreenController(props: Props) {
  const onPressPreviewFeatures = useCallback(() => {
    props.navigation.navigate('FeatureFlags');
  }, [props.navigation]);

  return (
    <AppInfoScreen
      onPressPreviewFeatures={onPressPreviewFeatures}
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
