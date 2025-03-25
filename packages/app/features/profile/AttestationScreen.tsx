import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { RootStackParamList } from '../../navigation/types';
import {
  PhoneAttestationPane,
  ScreenHeader,
  TwitterAttestationPane,
  View,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Attestation'>;

export function AttestationScreen({ route, navigation }: Props) {
  const { data: verifications, isLoading } = store.useVerifications();
  const currentUserId = useCurrentUserId();

  const twitterAttestation =
    verifications?.find(
      (v) => v.type === 'twitter' && v.contactId === currentUserId
    ) ?? null;

  const phoneAttestation =
    verifications?.find(
      (v) => v.type === 'phone' && v.contactId === currentUserId
    ) ?? null;

  console.log(`have attestation`, {
    twitterAttestation,
    verifications,
    isLoading,
  });

  return (
    <View flex={1} backgroundColor="$background">
      <ScreenHeader
        title={
          route.params.attestationType === 'twitter'
            ? 'Connect 𝕏 Account'
            : 'Connect Phone Number'
        }
        backAction={navigation.goBack}
      />
      {route.params.attestationType == 'twitter' ? (
        <TwitterAttestationPane
          attestation={twitterAttestation}
          isLoading={isLoading}
          currentUserId={currentUserId}
        />
      ) : (
        <PhoneAttestationPane
          isLoading={isLoading}
          currentUserId={currentUserId}
          attestation={phoneAttestation}
        />
      )}
    </View>
  );
}
