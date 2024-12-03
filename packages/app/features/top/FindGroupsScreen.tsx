import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FindGroupsView } from '@tloncorp/ui';

import { useGroupNavigation } from '../../hooks/useGroupNavigation';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function FindGroupsScreen({ navigation }: Props) {
  const { goToContactHostedGroups } = useGroupNavigation();
  return (
    <FindGroupsView
      goBack={() => navigation.goBack()}
      goToContactHostedGroups={goToContactHostedGroups}
    />
  );
}
