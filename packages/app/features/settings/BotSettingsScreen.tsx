import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { RootStackParamList } from '../../navigation/types';
import { BotSettingsHomeScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'BotSettings'>;

export function BotSettingsScreen(props: Props) {
  const handleBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  const handleConnectMcpPressed = useCallback(() => {
    props.navigation.navigate('BotMcpSettings');
  }, [props.navigation]);

  const handleOtherSettingsPressed = useCallback(() => {
    props.navigation.navigate('BotOtherSettings');
  }, [props.navigation]);

  return (
    <BotSettingsHomeScreenView
      onBackPressed={handleBack}
      onConnectMcpPressed={handleConnectMcpPressed}
      onOtherSettingsPressed={handleOtherSettingsPressed}
    />
  );
}
