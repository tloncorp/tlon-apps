import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
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
  const { data: attestations, isLoading } = store.useAttestations();
  const currentUserId = useCurrentUserId();
  const personalInviteLink = db.personalInviteLink.useValue();

  const twitterAttestation =
    attestations?.find(
      (v) => v.type === 'twitter' && v.contactId === currentUserId
    ) ?? null;

  const phoneAttestation =
    attestations?.find(
      (v) => v.type === 'phone' && v.contactId === currentUserId
    ) ?? null;

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
          personalInviteLink={personalInviteLink}
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
