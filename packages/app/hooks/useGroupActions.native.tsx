import { useNavigation } from '@react-navigation/native';
import * as db from '@tloncorp/shared/dist/db';
import { GroupPreviewAction } from '@tloncorp/ui';
import { useCallback } from 'react';

export const useGroupActions = () => {
  const navigation = useNavigation<
    // @ts-expect-error - TODO: pass navigation handlers into context
    NativeStackNavigationProp<RootStackParamList, 'Channel' | 'Post'>
  >();

  const performGroupAction = useCallback(
    async (action: GroupPreviewAction, updatedGroup: db.Group) => {
      if (action === 'goTo' && updatedGroup.lastPost?.channelId) {
        const channel = await db.getChannel({
          id: updatedGroup.lastPost.channelId,
        });
        if (channel) {
          navigation.navigate('Channel', { channel });
        }
      }

      if (action === 'joined') {
        navigation.navigate('ChatList');
      }
    },
    [navigation]
  );

  return {
    performGroupAction,
  };
};
