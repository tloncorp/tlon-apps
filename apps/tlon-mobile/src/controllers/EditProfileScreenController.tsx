import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EditProfileScreen } from '@tloncorp/app/features/settings/EditProfileScreen';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreenController(props: Props) {
  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  return <EditProfileScreen onGoBack={onGoBack} />;
}
