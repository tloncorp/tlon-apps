import { useNavigation } from '@react-navigation/native';
import { createDevLogger } from '@tloncorp/shared/dist';
import { useEffect, useRef } from 'react';

const logger = createDevLogger('navigation', false);

export function useNavigationLogging() {
  const navigation = useNavigation();
  const routeNameRef = useRef<string | undefined>();

  useEffect(() => {
    // Set initial route
    const state = navigation.getState();
    routeNameRef.current = state ? state.routes[state.index].name : '';

    const unsubscribe = navigation.addListener('state', () => {
      const previousRouteName = routeNameRef?.current ?? '';
      const state = navigation.getState();
      const currentRouteName = state ? state.routes[state.index].name : '';

      if (
        previousRouteName &&
        currentRouteName &&
        previousRouteName !== currentRouteName
      ) {
        logger.crumb(`to: ${currentRouteName}, from: ${previousRouteName}`);
      }

      // Update the route name ref
      routeNameRef.current = currentRouteName;
    });

    return unsubscribe;
  }, [logger, navigation]);
}
