import { PropsWithChildren } from 'react';
import { LayoutChangeEvent, StyleSheet } from 'react-native';

import { GlassSurface, GlassSurfaceGroup } from '../GlassSurface.ios';
import { floatingChromeMetrics as metrics } from '../floatingChromeMetrics';

export const usesFloatingMessageInputChrome = true;
// Height of the single-line floating row. The channel scroller adds the iOS
// safe-area inset separately so its final message can clear the composer.
export const floatingMessageInputBottomInset = 64;

export function MessageInputChromeRow({
  children,
  onLayout,
}: PropsWithChildren<{
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  return (
    <GlassSurfaceGroup
      spacing={metrics.rowGap}
      style={styles.row}
      onLayout={onLayout}
    >
      {children}
    </GlassSurfaceGroup>
  );
}

export function MessageInputChromeAction({
  children,
}: PropsWithChildren<{
  bottomSpacing?: 'xs' | '2xs';
}>) {
  return (
    <GlassSurface isInteractive style={styles.action}>
      {children}
    </GlassSurface>
  );
}

export function MessageInputChromeBody({
  children,
  isEditing,
  editingTintColor,
}: PropsWithChildren<{
  isEditing: boolean;
  editingTintColor: string;
}>) {
  return (
    <GlassSurface
      glassEffectStyle="regular"
      tintColor={isEditing ? editingTintColor : undefined}
      style={styles.body}
      fallbackStyle={styles.clipped}
    >
      {children}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: metrics.rowGap,
    paddingHorizontal: metrics.rowPaddingHorizontal,
    paddingVertical: metrics.rowPaddingVertical,
    backgroundColor: 'transparent',
  },
  action: {
    width: metrics.controlSize,
    height: metrics.controlSize,
    borderRadius: metrics.controlRadius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: metrics.controlSize,
    borderRadius: metrics.controlRadius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: metrics.rowGap,
  },
  clipped: {
    overflow: 'hidden',
  },
});
