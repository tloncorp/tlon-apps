import {
  NavigationState,
  PartialState,
  getStateFromPath,
} from '@react-navigation/native';

import { getDesktopLinkingConfig, getMobileLinkingConfig } from './linking';
import { CombinedParamList } from './types';

type BuildNavigationIntent<
  Feature extends string,
  Params extends Record<string, unknown> | undefined = undefined,
> = Params extends undefined
  ? { feature: Feature }
  : { feature: Feature; params: Params };

export type NavigationIntent =
  | BuildNavigationIntent<'unknown'>
  | BuildNavigationIntent<'channel-list'>
  | BuildNavigationIntent<'settings'>
  | BuildNavigationIntent<
      'group-dm',
      { channelId: string; selectedPostId?: string }
    >
  | BuildNavigationIntent<'dm', { channelId: string; selectedPostId?: string }>
  | BuildNavigationIntent<
      'channel',
      { groupId: string; channelId: string; selectedPostId?: string }
    >;

type ResultState = Exclude<ReturnType<typeof getStateFromPath>, undefined>;

export function getNavigationIntentFromState(
  state: ResultState,
  _navigatorType: 'mobile' | 'desktop'
): NavigationIntent {
  function getNavigationIntentFromRoute(
    // would be nice to make these types simpler!
    // it's not even giving us that much safety (since I had to drop the
    // ParamList param on NavigationState)
    route: Exclude<
      (NavigationState | PartialState<NavigationState>)['routes'][number],
      undefined
    >
  ): NavigationIntent | null {
    switch (route.name) {
      case 'Home':
        return { feature: 'channel-list' };
      case 'ChatList':
        return { feature: 'channel-list' };

      case 'DM': {
        return {
          feature: 'dm',
          params: {
            channelId: getChannelId(route),
            selectedPostId: getSelectedPostId(route),
          },
        };
      }

      case 'GroupDM': {
        return {
          feature: 'group-dm',
          params: {
            channelId: getChannelId(route),
            selectedPostId: getSelectedPostId(route),
          },
        };
      }

      case 'Channel':
        return {
          feature: 'channel',
          params: {
            channelId: getChannelId(route),
            groupId: getGroupId(route),
            selectedPostId: getSelectedPostId(route),
          },
        };

      case 'Settings': {
        return { feature: 'settings' };
      }

      default:
        return null;
    }
  }

  function findMatchDepthfirst(
    node: NavigationState | PartialState<NavigationState>
  ): NavigationIntent | null {
    const route =
      node.index == null
        ? // When using a stale state, `index` is undefined.
          // In this case, the last route in the list is assumed to be the focused route.
          node.routes.at(-1)
        : node.routes[node.index];
    if (route == null) {
      return null;
    }
    if (route.state == null) {
      return getNavigationIntentFromRoute(route);
    }
    return (
      findMatchDepthfirst(route.state) ?? getNavigationIntentFromRoute(route)
    );
  }

  return findMatchDepthfirst(state) ?? { feature: 'unknown' };
}

function pathFromNavigationIntent(
  intent: NavigationIntent,
  navigatorType: 'mobile' | 'desktop'
): string | null {
  const mobileOrDesktop = <T>(mobileOption: T, desktopOption: T) =>
    navigatorType === 'mobile' ? mobileOption : desktopOption;

  // TODO: Encode params
  // it feels like there should be utilities to actually use the linking config here instead of hoping they match...
  const withoutPrefix = (() => {
    switch (intent.feature) {
      case 'dm': {
        return mobileOrDesktop(
          `/dm/${intent.params.channelId}/undefined`,
          `/dm/${intent.params.channelId}`
        );
      }

      case 'channel-list': {
        return mobileOrDesktop('/ChatList', '/Home');
      }

      case 'channel': {
        return mobileOrDesktop(
          `/group/${intent.params.groupId}/channel/${intent.params.channelId}`,
          `/group/${intent.params.groupId}/channel/${intent.params.channelId}`
        );
      }

      case 'settings': {
        // These are the paths used when visiting settings, but navigating to
        // these paths ends up at the default route.
        return mobileOrDesktop(`/Settings`, `/Settings/SettingsEmpty`);
      }

      case 'group-dm': {
        return mobileOrDesktop(
          `/group-dm/${intent.params.channelId}/undefined`,
          `/group-dm/${intent.params.channelId}`
        );
      }

      case 'unknown': {
        return null;
      }
    }
  })();

  return withoutPrefix == null ? null : `/apps/groups${withoutPrefix}`;
}

export function getStateFromNavigationIntent(
  intent: NavigationIntent,
  navigatorType: 'mobile' | 'desktop'
): PartialState<NavigationState<CombinedParamList>> | null {
  const url = pathFromNavigationIntent(intent, navigatorType);
  if (url == null) {
    return null;
  }

  // @ts-expect-error - `getStateFromPath` from react-navigation uses a
  // non-parameterized type, despite being tied to the passed in `options`
  return navigatorType === 'mobile'
    ? getStateFromPath(url, getMobileLinkingConfig('').config) ?? null
    : getStateFromPath(url, getDesktopLinkingConfig('').config) ?? null;
}

// stubs to be replaced by https://github.com/tloncorp/tlon-apps/pull/4803
function getChannelId(route: any): string {
  return getParamValue<string>(route, 'channelId') ?? '';
}
function getGroupId(route: any): string {
  return getParamValue<string>(route, 'groupId') ?? '';
}
function getSelectedPostId(route: any): string | undefined {
  return getParamValue<string>(route, 'selectedPostId');
}
function getParamValue<T>(
  route: any,
  paramName: string,
  defaultValue?: T
): T | undefined {
  // Handle null or undefined route
  if (!route) return defaultValue;

  // Direct access - route.params[paramName]
  if (route.params && typeof route.params[paramName] !== 'undefined') {
    return route.params[paramName] as T;
  }

  // Nested params - route.params.params[paramName]
  if (
    route.params?.params &&
    typeof route.params.params[paramName] !== 'undefined'
  ) {
    return route.params.params[paramName] as T;
  }

  // Screen → params pattern often used in nested navigators
  if (
    route.params?.screen &&
    route.params.params &&
    typeof route.params.params[paramName] !== 'undefined'
  ) {
    return route.params.params[paramName] as T;
  }

  // Deep nesting common in desktop navigators
  if (
    route.params?.params?.screen &&
    route.params.params.params &&
    typeof route.params.params.params[paramName] !== 'undefined'
  ) {
    return route.params.params.params[paramName] as T;
  }

  return defaultValue;
}
