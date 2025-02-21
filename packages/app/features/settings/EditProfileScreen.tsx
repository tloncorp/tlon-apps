import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/store';

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

  return (
    <GroupsProvider groups={groups ?? []}>
      <AttachmentProvider canUpload={canUpload} uploadAsset={store.uploadAsset}>
        <EditProfileScreenView
          userId={route.params.userId}
          onGoBack={() => navigation.goBack()}
        />
      </AttachmentProvider>
    </GroupsProvider>
  );
}
