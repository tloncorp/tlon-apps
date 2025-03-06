import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';

import { RootStackParamList } from '../../navigation/types';
import { AttestationScreenView, ScreenHeader, View } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Attestation'>;

export function AttestationScreen({ route, navigation }: Props) {
  const { data: verifications, isLoading } = store.useVerifications();
  const twitterAttestation =
    verifications?.find((v) => v.type === 'twitter') ?? null;

  console.log(`have attestation`, {
    twitterAttestation,
    verifications,
    isLoading,
  });

  return (
    <View flex={1}>
      <ScreenHeader
        title={
          route.params.attestationType === 'twitter'
            ? 'Verify 𝕏 Account'
            : 'Link Phone Number'
        }
        backAction={navigation.goBack}
      />
      <AttestationScreenView
        attestationType={route.params.attestationType}
        attestation={twitterAttestation}
        isLoading={isLoading}
      />
    </View>
  );
}
