import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { useFeatureFlag } from '../../lib/featureFlags';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ route, navigation }: Props) {
  const canUpload = store.useCanUpload();
  const showAttestations = useFeatureFlag('attestations')[0];
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const handleGoToAttestation = useCallback(() => {
    navigation.navigate('Attestation', { attestationType: 'twitter' });
  }, [navigation]);

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
