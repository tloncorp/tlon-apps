import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { useFeatureFlag } from '../../lib/featureFlags';
import { RootStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ route, navigation }: Props) {
  const canUpload = store.useCanUpload();
  const showAttestations = useFeatureFlag('attestations')[0];
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const handleGoToAttestation = useCallback(
    (attestationType: 'twitter' | 'phone') => {
      navigation.navigate('Attestation', { attestationType });
    },
    [navigation]
  );

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <EditProfileScreenView
          userId={route.params.userId}
          onGoBack={() => navigation.goBack()}
          showAttestations={showAttestations}
          onGoToAttestation={handleGoToAttestation}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
