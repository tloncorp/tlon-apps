import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useVerifications } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  Button,
  FeatureFlagScreenView,
  ListItem,
  ScreenHeader,
  TlonText,
  View,
  YStack,
} from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import * as featureFlags from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifierStub'>;

export function VerifierStubScreen({ navigation }: Props) {
  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const { data: verifications } = useVerifications();

  return (
    <View flex={1}>
      <ScreenHeader backAction={handleGoBackPressed} title="Verifier Stub" />
      <YStack>
        <Button>
          <Button.Text>Fetch Verifications</Button.Text>
        </Button>
      </YStack>
      <YStack>
        <TlonText.RawText>Verifications</TlonText.RawText>
        {verifications?.map((verification) => (
          <ListItem key={verification.value}>
            <ListItem.MainContent>
              <ListItem.Title>{verification.value}</ListItem.Title>
            </ListItem.MainContent>
          </ListItem>
        ))}
      </YStack>
    </View>
  );
}
