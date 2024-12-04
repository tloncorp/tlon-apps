import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CreateGroupView } from '@tloncorp/ui';

import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function CreateGroupScreen(props: Props) {
  const { resetToGroup } = useRootNavigation();

  return (
    <CreateGroupView
      goBack={() => props.navigation.goBack()}
      navigateToGroup={resetToGroup}
    />
  );
}
