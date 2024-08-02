import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/shared/dist/api';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  EditProfileScreenView,
  View,
} from '@tloncorp/ui';
import { useCallback } from 'react';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen(props: Props) {
  const currentUserId = useCurrentUserId();
  const { data: contacts } = store.useContacts();

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

  const onEditFavoriteGroups = useCallback(() => {
    props.navigation.navigate('EditFavoriteGroups');
  }, [props.navigation]);

  const canUpload = store.useCanUpload();

  return (
    <AppDataContextProvider
      currentUserId={currentUserId}
      contacts={contacts ?? []}
    >
      <View flex={1}>
        <EditProfileScreenView
          canUpload={canUpload}
          uploadAsset={store.uploadAsset}
          onGoBack={onGoBack}
          onSaveProfile={onSaveProfile}
          onEditFavoriteGroups={onEditFavoriteGroups}
        />
      </View>
    </AppDataContextProvider>
  );
}
