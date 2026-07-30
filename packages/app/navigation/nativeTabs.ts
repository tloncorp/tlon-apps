import type { NativeTabParamList } from './types';

type NativeTabName = keyof NativeTabParamList;

interface RedirectRoute {
  key?: string;
  name: string;
  params?: unknown;
}

interface RedirectState<Route extends RedirectRoute> {
  index: number;
  routes: readonly Route[];
}

export function resolveNativeTabRedirectState<Route extends RedirectRoute>({
  state,
  route,
}: {
  state: RedirectState<Route>;
  route: {
    key: string;
    name: NativeTabName;
    params?: NativeTabParamList[NativeTabName];
  };
}) {
  const selfIndex = state.routes.findIndex(
    (candidate) => candidate.key === route.key
  );
  if (selfIndex === -1) {
    return null;
  }

  const tabRoute = {
    name: 'MainTabs' as const,
    params: {
      screen: route.name,
      params: route.params,
    },
  };
  const existingTabsIndex = state.routes.findIndex(
    (candidate, index) => candidate.name === 'MainTabs' && index !== selfIndex
  );
  const routes =
    existingTabsIndex === -1
      ? state.routes.map((candidate, index) =>
          index === selfIndex ? tabRoute : candidate
        )
      : state.routes
          .map((candidate, index) =>
            index === existingTabsIndex ? tabRoute : candidate
          )
          .filter((_, index) => index !== selfIndex);

  const focusedKey = state.routes[state.index]?.key;
  const preservedFocusedIndex = routes.findIndex(
    (candidate) => 'key' in candidate && candidate.key === focusedKey
  );
  const fallbackTabIndex = routes.findIndex(
    (candidate) => candidate.name === 'MainTabs'
  );

  return {
    index:
      preservedFocusedIndex !== -1
        ? preservedFocusedIndex
        : fallbackTabIndex === -1
          ? routes.length - 1
          : fallbackTabIndex,
    routes,
  };
}
