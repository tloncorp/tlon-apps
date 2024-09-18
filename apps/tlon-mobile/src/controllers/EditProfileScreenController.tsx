import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EditProfileScreen } from '@tloncorp/app/features/settings/EditProfileScreen';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreenController(props: Props) {
  return <EditProfileScreen onGoBack={() => props.navigation.goBack()} />;
}
