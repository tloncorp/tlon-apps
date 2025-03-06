import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import { ScreenHeader, TwitterAttestationPane, View } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Attestation'>;

export function AttestationScreen({ route, navigation }: Props) {
  const { data: verifications, isLoading } = store.useVerifications();
  const currentUserId = useCurrentUserId();
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
            : 'Verify Phone Number'
        }
        backAction={navigation.goBack}
      />
      <TwitterAttestationPane
        attestation={twitterAttestation}
        isLoading={isLoading}
        currentUserId={currentUserId}
      />
    </View>
  );
}
