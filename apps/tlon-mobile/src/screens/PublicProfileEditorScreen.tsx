import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FeatureFlagScreenView,
  PublicProfileEditorScreenView,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import * as featureFlags from '../lib/featureFlags';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicProfileEditor'>;

export function PublicProfileEditorScreen({ route, navigation }: Props) {
  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return <PublicProfileEditorScreenView goBack={goBack} />;
}
