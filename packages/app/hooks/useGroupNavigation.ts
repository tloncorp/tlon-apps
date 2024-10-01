import { useNavigation } from '@react-navigation/native';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

export const useGroupNavigation = () => {
  const navigation = useNavigation<
    // @ts-expect-error - TODO: pass navigation handlers into context
    NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
  >();

  const goToChannel = useCallback(
    async (channel: db.Channel) => {
      navigation.navigate('Channel', { channel });
    },
    [navigation]
  );

  const goToHome = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  const goToContactHostedGroups = useCallback(
    ({ contactId }: { contactId: string }) => {
      navigation.navigate('ContactHostedGroups', { contactId });
    },
    [navigation]
  );

  return {
    goToChannel,
    goToHome,
    goToContactHostedGroups,
  };
};
