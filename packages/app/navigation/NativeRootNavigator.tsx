import {
  type NavigationState,
  NavigationContainerRefContext,
} from '@react-navigation/native';
import { setNativeSplitLayoutMounted, useIsWindowNarrow } from '@tloncorp/ui';
import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useAgentGroupOnboardingStartupRoute } from '../hooks/useAgentGroupOnboardingLock';
import { useTheme } from '../ui';
import { FoldSplitProvider } from './FoldSplitProvider';
import { RootStack } from './RootStack';
import { TopLevelDrawer } from './desktop/TopLevelDrawer';
import { navigateRoot } from './navigateRoot';
import {
  getRestoredNavigationLayout,
  setRestoredNavigationLayout,
} from './navigationRestore';
import {
  type LayoutPosition,
  type NativeLayout,
  getLayoutPosition,
  getLayoutState,
  isSamePlace,
  isSplitLayoutWidth,
} from './splitLayoutState';
import type { RootStackParamList } from './types';

type LayoutState = {
  index: number;
  routes: { name: string; params?: object; state?: object }[];
};

type LeftPlace = {
  layout: NativeLayout;
  position: LayoutPosition;
  state: NavigationState;
};

type PendingSwitch = {
  toSplit: boolean;
  state: LayoutState | null;
  left: LeftPlace | null;
};

// The tab the phone tree should open on, so it mounts there rather than on
// its default tab and then moves.
function getMainTabsParams(state: LayoutState | null) {
  const mainTabs = state?.routes[0];
  if (mainTabs?.name !== 'MainTabs') {
    return undefined;
  }
  const tabs = mainTabs.state as
    | { index?: number; routes: { name: string; params?: object }[] }
    | undefined;
  const focusedTab = tabs?.routes[tabs.index ?? 0];
  if (focusedTab) {
    return {
      ...mainTabs.params,
      screen: focusedTab.name,
      params: focusedTab.params,
    } as RootStackParamList['MainTabs'];
  }
  return mainTabs.params as RootStackParamList['MainTabs'];
}

// Split Home maps to the phone tree's default tab, which is the bot chat when
// the account has one; still sitting there is still Home.
function isOnBotTabOnly(state: NavigationState | undefined) {
  const mainTabs = state?.routes.length === 1 ? state.routes[0] : undefined;
  const tabs = mainTabs?.name === 'MainTabs' ? mainTabs.state : undefined;
  return tabs?.routes[tabs.index ?? 0]?.name === 'BotChat';
}

/**
 * The native navigator root: the phone RootStack in narrow windows, and the
 * desktop TopLevelDrawer (list and detail side by side) in wide ones, such as
 * an iPad or an unfolded foldable. Switching trees carries the open place
 * across, since the two trees do not share route names.
 */
export function NativeRootNavigator() {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const container = useContext(NavigationContainerRefContext);
  const onboardingStartup = useAgentGroupOnboardingStartupRoute();
  const splitMounted = !useIsWindowNarrow();
  const [hasMounted, setHasMounted] = useState(false);
  const [restoreSettled, setRestoreSettled] = useState(false);
  // A restored position only fits the tree it was shaped for, so that tree
  // mounts first; a window that has crossed the breakpoint since then
  // switches trees like any resize.
  const restoredLayout = restoreSettled ? null : getRestoredNavigationLayout();
  // First-run onboarding runs in the phone tree, which owns its startup route.
  const wantsSplit = restoredLayout
    ? restoredLayout === 'split'
    : isSplitLayoutWidth(width) && !onboardingStartup.route;
  const switching = !onboardingStartup.isLoading && wantsSplit !== splitMounted;
  const [pending, setPending] = useState<PendingSwitch | null>(null);
  // Where the user was in the tree that was last swapped out. Coming back to
  // the same place restores what only that tree can express: the phone tab
  // (the bot chat or Workspaces) and stack, or the split layout's Messages
  // section.
  const [lastPlace, setLastPlace] = useState<LeftPlace | null>(null);

  // Read where the user is before the outgoing tree unmounts. It is not
  // rendered again: at the new window size the drawer would schedule a
  // close that lands after it is gone.
  if (switching && hasMounted && pending?.toSplit !== wantsSplit) {
    const target: NativeLayout = wantsSplit ? 'split' : 'phone';
    const rootState = onboardingStartup.route
      ? undefined
      : container?.getRootState();
    const position = getLayoutPosition(rootState);
    const left = lastPlace;
    const returning =
      position &&
      left?.layout === target &&
      (isSamePlace(left.position, position) ||
        (left.position.kind === 'home' && isOnBotTabOnly(rootState)))
        ? left
        : null;
    let state: LayoutState | null = null;
    if (returning && target === 'phone') {
      state = { index: returning.state.index, routes: returning.state.routes };
    } else if (returning) {
      state = getLayoutState(returning.position, target);
    } else if (position) {
      state = getLayoutState(position, target);
    }
    setPending({
      toSplit: wantsSplit,
      state,
      left:
        position && rootState
          ? {
              layout: wantsSplit ? 'phone' : 'split',
              position,
              state: rootState,
            }
          : null,
    });
  }
  if (!hasMounted && !switching && !onboardingStartup.isLoading) {
    setHasMounted(true);
  }

  useLayoutEffect(() => {
    if (switching) {
      setNativeSplitLayoutMounted(wantsSplit);
    }
  }, [switching, wantsSplit]);

  // The tree that just mounted starts from its initial route; the reset has to
  // wait for its navigator to register with the container.
  useEffect(() => {
    if (!pending || pending.toSplit !== splitMounted) {
      return;
    }
    setLastPlace(pending.left);
    if (pending.state && pending.toSplit) {
      // Navigating keeps the drawer routes the tree just mounted with. A reset
      // would replace them, and the close each drawer schedules on mount would
      // then arrive for a navigator that no longer exists.
      navigateRoot(container, pending.state.routes[0]);
    } else if (pending.state && pending.state.routes.length > 1) {
      // The tabs already mounted on the right tab; keep that route so they
      // are not mounted again. resetRoot targets the root navigator; a plain
      // reset from the container goes to the deepest focused navigator first.
      const mountedTabs = container?.getRootState()?.routes[0];
      container?.resetRoot({
        index: pending.state.index,
        routes: [
          mountedTabs ?? pending.state.routes[0],
          ...pending.state.routes.slice(1),
        ],
      } as Parameters<NonNullable<typeof container>['resetRoot']>[0]);
    }
    const frame = requestAnimationFrame(() => setPending(null));
    return () => cancelAnimationFrame(frame);
  }, [container, pending, splitMounted]);

  // Runs once the first tree has committed, so a switch that follows can read
  // the restored position from it.
  useEffect(() => {
    if (hasMounted && !restoreSettled) {
      setRestoredNavigationLayout(null);
      setRestoreSettled(true);
    }
  }, [hasMounted, restoreSettled]);

  useEffect(() => () => setNativeSplitLayoutMounted(false), []);

  if (onboardingStartup.isLoading) {
    return null;
  }
  const cover = <Cover color={theme.background?.val} />;
  if (switching) {
    // The first mount waits here for the layout effect to settle which tree
    // to mount, so the container's initial state lands in the right one.
    return hasMounted ? cover : null;
  }

  return (
    <View style={styles.fill}>
      {splitMounted ? (
        <FoldSplitProvider>
          <TopLevelDrawer />
        </FoldSplitProvider>
      ) : (
        <RootStack
          initialMainTabsParams={getMainTabsParams(pending?.state ?? null)}
        />
      )}
      {pending?.state ? cover : null}
    </View>
  );
}

function Cover({ color }: { color?: string }) {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
