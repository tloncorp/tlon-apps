import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import {
  AttachmentProvider,
  EditProfileScreenView,
  GroupsProvider,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ route, navigation }: Props) {
  const canUpload = store.useCanUpload();
  const { data: groups } = store.useGroups({ includeUnjoined: true });

  const handleGoToAttestation = useCallback(
    (attestationType: 'twitter' | 'phone') => {
      navigation.navigate('Attestation', { attestationType });
    },
    [navigation]
  );

  const handleGoBack = useCallback(() => {
    // We'll always go back to the profile screen of the user being edited
    // navigation.goBack() was sometimes not working as expected (particularly in the Activity tab)
    navigation.navigate('UserProfile', {
      userId: route.params.userId,
    });
  }, [navigation, route.params.userId]);

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <EditProfileScreenView
          userId={route.params.userId}
          onGoBack={handleGoBack}
          onGoToAttestation={handleGoToAttestation}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
