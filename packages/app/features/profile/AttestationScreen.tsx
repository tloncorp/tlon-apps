import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import {
  AttachmentProvider,
  AttestationScreenView,
  ControlledTextField,
  EditProfileScreenView,
  GroupsProvider,
  ScreenHeader,
  View,
} from '@tloncorp/ui';
import { useForm } from 'react-hook-form';

import { useFeatureFlag } from '../../lib/featureFlags';
import { RootStackParamList } from '../../navigation/types';

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
      <ScreenHeader title="Attestation" backAction={navigation.goBack} />
      <AttestationScreenView
        attestationType={route.params.attestationType}
        attestation={twitterAttestation}
        isLoading={isLoading}
      />
    </View>
  );
}
