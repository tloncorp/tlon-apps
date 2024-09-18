import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { UserBugReportScreen } from '@tloncorp/app/features/settings/UserBugReportScreen';
import { useCallback } from 'react';

import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'WompWomp'>;

export function UserBugReportScreenController(props: Props) {
  const onGoBack = useCallback(() => {
    props.navigation.goBack();
  }, [props.navigation]);

  return <UserBugReportScreen onGoBack={onGoBack} />;
}
