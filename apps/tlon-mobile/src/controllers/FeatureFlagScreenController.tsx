import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeatureFlagScreen } from '@tloncorp/app/features/settings/FeatureFlagScreen';

import type { RootStackParamList } from '../types';

type FeatureFlagScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FeatureFlags'
>;

export function FeatureFlagScreenController({
  navigation,
}: FeatureFlagScreenProps) {
  return <FeatureFlagScreen onGoBack={() => navigation.goBack()} />;
}
