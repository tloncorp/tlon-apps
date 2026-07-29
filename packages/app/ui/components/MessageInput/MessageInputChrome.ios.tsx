import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import {
  LayoutChangeEvent,
  View as NativeView,
  StyleSheet,
} from 'react-native';

import { floatingChromeMetrics as metrics } from '../floatingChromeMetrics';
import { canUseLiquidGlass, glassFallbackBlurProps } from '../glassChrome.ios';

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
  if (canUseLiquidGlass()) {
    return (
      <GlassContainer
        spacing={metrics.rowGap}
        style={styles.row}
        onLayout={onLayout}
      >
        {children}
      </GlassContainer>
    );
  }

  return (
    <NativeView style={styles.row} onLayout={onLayout}>
      {children}
    </NativeView>
  );
}

export function MessageInputChromeAction({
  children,
}: PropsWithChildren<{
  bottomSpacing?: 'xs' | '2xs';
}>) {
  if (canUseLiquidGlass()) {
    return (
      <GlassView isInteractive style={styles.action}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView {...glassFallbackBlurProps} style={styles.action}>
      {children}
    </BlurView>
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
  if (canUseLiquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={isEditing ? editingTintColor : undefined}
        style={styles.body}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView {...glassFallbackBlurProps} style={[styles.body, styles.clipped]}>
      {children}
    </BlurView>
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
