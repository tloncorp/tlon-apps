import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PushNotificationSettingsScreen } from '@tloncorp/app/features/settings/PushNotificationSettingsScreen';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export function PushNotificationSettingsScreenController(props: Props) {
  return (
    <PushNotificationSettingsScreen
      onGoBack={() => props.navigation.goBack()}
    />
  );
}
