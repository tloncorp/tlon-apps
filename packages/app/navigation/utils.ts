import {
  CommonActions,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import * as store from '@tloncorp/shared/store';

import { RootStackParamList } from './types';

type ResetRouteConfig<T extends Record<string, any>> = {
  name: Extract<keyof T, string>;
  params?: T[Extract<keyof T, string>];
};

export function createTypedReset<T extends Record<string, any>>(
  navigation: NavigationProp<T>
) {
  return function reset(
    routes: ResetRouteConfig<T>[],
    index = routes.length - 1
  ) {
    navigation.dispatch(
      // eslint-disable-next-line no-restricted-syntax
      CommonActions.reset({
        index,
        routes,
      })
    );
  };
}

// This is a custom hook that returns a function that resets the navigation stack
// to the provided routes. It's useful for resetting the navigation stack to a
// specific route or set of routes.
export function useTypedReset() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return createTypedReset(navigation);
}

export function useResetToChannel() {
  const reset = useTypedReset();

  return function resetToChannel(
    channelId: string,
    options?: {
      groupId?: string;
      selectedPostId?: string | null;
      startDraft?: boolean;
    }
  ) {
    reset([
      { name: 'ChatList' },
      {
        name: 'Channel',
        params: {
          channelId,
          ...options,
        },
      },
    ]);
  };
}

export function useResetToDm() {
  const resetToChannel = useResetToChannel();

  return async function resetToDm(contactId: string) {
    try {
      const dmChannel = await store.upsertDmChannel({
        participants: [contactId],
      });
      resetToChannel(dmChannel.id);
    } catch (error) {
      console.error('Error creating DM channel:', error);
    }
  };
}
