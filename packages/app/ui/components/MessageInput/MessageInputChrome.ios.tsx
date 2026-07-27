import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { PropsWithChildren } from 'react';
import {
  LayoutChangeEvent,
  View as NativeView,
  StyleSheet,
} from 'react-native';

export const usesFloatingMessageInputChrome = true;
// Height of the single-line floating row. The channel scroller adds the iOS
// safe-area inset separately so its final message can clear the composer.
export const floatingMessageInputBottomInset = 64;

function canUseLiquidGlass() {
  return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}

export function MessageInputChromeRow({
  children,
  onLayout,
}: PropsWithChildren<{
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  if (canUseLiquidGlass()) {
    return (
      <GlassContainer spacing={8} style={styles.row} onLayout={onLayout}>
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
    <BlurView tint="systemMaterial" intensity={90} style={styles.action}>
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
    <BlurView
      tint="systemMaterial"
      intensity={90}
      style={[styles.body, styles.clipped]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  action: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clipped: {
    overflow: 'hidden',
  },
});
