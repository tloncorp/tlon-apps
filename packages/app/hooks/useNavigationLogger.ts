import type { NavigationState } from '@react-navigation/native';
import { createDevLogger } from '@tloncorp/shared';
import { useRef } from 'react';

const logger = createDevLogger('navigation', false);

/**
 * Recursively formats navigation state as a readable string showing all
 * routes in each navigator. Active routes are marked with *.
 * Example: Root[Home*,Activity] > Home[Channel*,ChatDetails] > Channel[ChannelRoot,GroupSettings*] > GroupSettings[GroupRoles*]
 */
function formatNavState(state: any, depth = 0): string {
  if (!state || !state.routes) return '';

  const routeNames = state.routes.map((r: any, i: number) => {
    const active = i === (state.index ?? 0);
    return `${r.name}${active ? '*' : ''}`;
  });

  const activeRoute = state.routes[state.index ?? 0];
  const nested = activeRoute?.state
    ? ' > ' + formatNavState(activeRoute.state, depth + 1)
    : '';

  return `[${routeNames.join(',')}]${nested}`;
}

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

    // Log the full navigation tree for debugging
    if (state) {
      console.log('[NAV]', formatNavState(state));
    }

    // Update the route name ref
    routeNameRef.current = currentRouteName;
  };

  return {
    onReady,
    onStateChange,
  };
}
