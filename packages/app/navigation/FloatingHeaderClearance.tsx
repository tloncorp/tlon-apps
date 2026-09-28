import type { ReactNode } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  type EdgeRecord,
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { supportsLiquidGlass } from '../ui/components/GlassSurface';
import { supportsNativeScrollEdgeChrome } from './nativeHeaderOptions';
import { useFloatingHeaderHeight } from './useFloatingHeaderHeight';

const measuredTopEdge: EdgeRecord = { top: 'maximum' };

/**
 * Moves content that sits above a list, such as filter tabs, down out from
 * under a floating native header, as layout rather than as a scroll inset.
 *
 * `useFloatingHeaderHeight` alone is not enough here. It reads JS state that
 * native-stack corrects only when react-native-screens reports the bar again,
 * and a cold launch has left it at 0 under a visible glass header until the
 * next header update (switching sections), which put Activity's tabs under
 * the status bar. So UIKit sets the floor: a provider nested here reads the
 * safe area at this spot, which takes in a translucent navigation bar, and
 * the padding never drops below it. The JS height is only the starting value,
 * for the frame before that measurement lands.
 *
 * Only the padding comes from the nested measurement. Descendants get back
 * the window's insets, so sheets and anything else sized by them are
 * unchanged.
 */
export function FloatingHeaderClearance({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const estimatedClearance = useFloatingHeaderHeight();

  if (
    !supportsNativeScrollEdgeChrome(
      Platform.OS,
      Platform.Version,
      supportsLiquidGlass()
    )
  ) {
    return children;
  }

  return (
    <SafeAreaProvider style={styles.fill}>
      <SafeAreaView
        edges={measuredTopEdge}
        style={[styles.fill, { paddingTop: estimatedClearance }]}
      >
        <SafeAreaFrameContext.Provider value={frame}>
          <SafeAreaInsetsContext.Provider value={insets}>
            {children}
          </SafeAreaInsetsContext.Provider>
        </SafeAreaFrameContext.Provider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
