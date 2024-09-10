import { Text } from '@tloncorp/ui';
import { SafeAreaView } from 'react-native-safe-area-context';

export function GroupRolesScreen({
  groupId,
  onGoBack,
}: {
  groupId: string;
  onGoBack: () => void;
}) {
  return (
    <SafeAreaView>
      <Text>GroupRoles</Text>
    </SafeAreaView>
  );
}
