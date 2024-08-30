import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ManageAccountScreen } from '@tloncorp/app/features/settings/ManageAccountScreen';

import { useWebView } from '../hooks/useWebView';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageAccount'>;

export function ManageAccountScreenController(props: Props) {
  const webview = useWebView();

  return (
    <ManageAccountScreen
      onGoBack={() => props.navigation.goBack()}
      webview={webview}
    />
  );
}
