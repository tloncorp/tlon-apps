import {
  WindowSafeAreaInsetsContext,
  useWindowSafeAreaInsets,
} from '@tloncorp/ui';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { Platform } from 'react-native';
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { SideInsetView } from '../SideInsetScreenLayout';

/**
 * Gives one pane of the split layout its own safe-area insets. A nested
 * SafeAreaProvider measures its own view, so screens in a pane only see the
 * insets of the window edges that pane touches. Until the native measurement
 * arrives it starts from the window insets with the other side edges zeroed,
 * rather than the full window insets it would otherwise inherit.
 *
 * Web has no side chrome, so the pane renders its children as they are.
 */
export function PaneSafeAreaProvider({
  touchesLeft,
  touchesRight,
  children,
}: {
  touchesLeft: boolean;
  touchesRight: boolean;
  children: ReactNode;
}) {
  const windowInsets = useWindowSafeAreaInsets();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  if (Platform.OS === 'web') {
    return <>{children}</>;
  }
  const initialMetrics = {
    frame,
    insets: {
      ...insets,
      left: touchesLeft ? insets.left : 0,
      right: touchesRight ? insets.right : 0,
    },
  };
  return (
    <WindowSafeAreaInsetsContext.Provider value={windowInsets}>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        {children}
      </SafeAreaProvider>
    </WindowSafeAreaInsetsContext.Provider>
  );
}

/** `drawerContent` wrapper for a sidebar list pane, between rail and detail. */
export function ListPaneSafeArea({ children }: { children: ReactNode }) {
  return (
    <PaneSafeAreaProvider touchesLeft={false} touchesRight={false}>
      {children}
    </PaneSafeAreaProvider>
  );
}

// Screens inside SideInsetView are already clear of the side insets. The
// media viewer, which pads its own controls for them, would otherwise pad
// twice.
function SideInsetsApplied({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const value = useMemo(() => ({ ...insets, left: 0, right: 0 }), [insets]);
  return (
    <SafeAreaInsetsContext.Provider value={value}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}

/**
 * Navigator `screenLayout` for the detail pane, which meets the window's right
 * edge and keeps its screens out of the side chrome there.
 */
export function detailPaneScreenLayout({
  children,
}: {
  children: ReactElement;
}) {
  if (Platform.OS === 'web') {
    return children;
  }
  return (
    <PaneSafeAreaProvider touchesLeft={false} touchesRight>
      <SideInsetView>
        <SideInsetsApplied>{children}</SideInsetsApplied>
      </SideInsetView>
    </PaneSafeAreaProvider>
  );
}
