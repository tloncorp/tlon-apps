import type { NavigationState } from '@react-navigation/native';
import { createDevLogger } from '@tloncorp/shared';
import { useRef } from 'react';

const logger = createDevLogger('navigation', false);

export function useNavigationLogging() {
  const routeNameRef = useRef<string | undefined>(undefined);

  const onReady = (state: NavigationState | undefined) => {
    routeNameRef.current = state ? state.routes[state.index]?.name : '';
  };

  const onStateChange = (state: NavigationState | undefined) => {
    const previousRouteName = routeNameRef?.current ?? '';
    const currentRouteName = state ? state.routes[state.index]?.name : '';

    if (
      previousRouteName &&
      currentRouteName &&
      previousRouteName !== currentRouteName
    ) {
      logger.crumb(`to: ${currentRouteName}, from: ${previousRouteName}`);
    }
    logger.log(
      `to: ${currentRouteName}, from: ${previousRouteName}`,
      'current state:',
      state
    );

    // Update the route name ref
    routeNameRef.current = currentRouteName;
  };

  return {
    onReady,
    onStateChange,
  };
}
