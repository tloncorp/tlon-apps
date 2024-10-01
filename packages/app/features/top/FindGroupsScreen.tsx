import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FindGroupsView } from '@tloncorp/ui';

import { useGroupActions } from '../../hooks/useGroupActions';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export function FindGroupsScreen({ navigation }: Props) {
  const { performGroupAction } = useGroupActions();

  return (
    <FindGroupsView
      onCancel={() => navigation.goBack()}
      onGroupAction={performGroupAction}
    />
  );
}
