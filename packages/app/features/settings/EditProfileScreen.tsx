import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCanUpload, useGroups, uploadAsset } from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ route, navigation }: Props) {
  const canUpload = useCanUpload();
  const { data: groups } = useGroups({ includeUnjoined: true });

  const handleGoToAttestation = useCallback(
    (attestationType: 'twitter' | 'phone') => {
      navigation.navigate('Attestation', { attestationType });
    },
    [navigation]
  );

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={uploadAsset}>
        <EditProfileScreenView
          userId={route.params.userId}
          onGoBack={navigation.goBack}
          onGoToAttestation={handleGoToAttestation}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
