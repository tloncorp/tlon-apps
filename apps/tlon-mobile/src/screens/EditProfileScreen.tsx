import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import {
  ContactsProvider,
  EditProfileScreenView,
  View,
  useContacts,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { useImageUpload } from '../hooks/useImageUpload';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();
  const uploadInfo = useImageUpload({
    uploaderKey: 'profile-edit',
  });

  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const onSaveProfile = useCallback(
    (update: api.ProfileUpdate) => {
      store.updateCurrentUserProfile(update);
      props.navigation.goBack();
    },
    [props.navigation]
  );

  return (
    <ContactsProvider contacts={contacts ?? []}>
      <View flex={1}>
        <EditProfileScreenView
          currentUserId={currentUserId}
          uploadInfo={uploadInfo}
          onGoBack={onGoBack}
          onSaveProfile={onSaveProfile}
        />
      </View>
    </ContactsProvider>
  );
}
