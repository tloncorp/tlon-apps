import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

export function useNavigationLogging(
  logger: (from: string, to: string) => void
) {
  const navigation = useNavigation();
  const routeNameRef = useRef<string | undefined>();

  useEffect(() => {
    console.log('Setting up navigation logging');

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
        logger(previousRouteName, currentRouteName);
      }

      // Update the route name ref
      routeNameRef.current = currentRouteName;
    });

    return unsubscribe;
  }, [logger, navigation]);
}
