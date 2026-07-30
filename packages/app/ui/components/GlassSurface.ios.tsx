import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { ComponentProps, PropsWithChildren } from 'react';
import {
  LayoutChangeEvent,
  View as NativeView,
  StyleProp,
  ViewStyle,
} from 'react-native';

import { canUseLiquidGlass, glassFallbackBlurProps } from './glassChrome.ios';

type GlassViewProps = ComponentProps<typeof GlassView>;

/**
 * A floating chrome surface: Liquid Glass where the device supports it, the
 * standard blur fallback where it does not.
 *
 * Every floating iOS surface renders through this so the capability check and
 * the fallback treatment live in one place - previously each surface repeated
 * the branch, which is how one could end up glass while its neighbour stayed
 * blurred.
 *
 * Glass props are passed straight through and left `undefined` when unset, so
 * each call site gets exactly the rendering it had before.
 */
export function GlassSurface({
  children,
  style,
  fallbackStyle,
  glassEffectStyle,
  isInteractive,
  tintColor,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** Applied only to the blur fallback, e.g. clipping the glass doesn't need. */
  fallbackStyle?: StyleProp<ViewStyle>;
  glassEffectStyle?: GlassViewProps['glassEffectStyle'];
  isInteractive?: GlassViewProps['isInteractive'];
  tintColor?: GlassViewProps['tintColor'];
}>) {
  if (canUseLiquidGlass()) {
    return (
      <GlassView
        glassEffectStyle={glassEffectStyle}
        isInteractive={isInteractive}
        tintColor={tintColor}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      {...glassFallbackBlurProps}
      style={fallbackStyle ? [style, fallbackStyle] : style}
    >
      {children}
    </BlurView>
  );
}

/**
 * Groups sibling `GlassSurface`s so the platform can merge and space them as
 * one glass system. Falls back to a plain view, which is what the blur
 * treatment wants - the children carry their own blur.
 */
export function GlassSurfaceGroup({
  children,
  style,
  spacing,
  onLayout,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  spacing?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}>) {
  if (canUseLiquidGlass()) {
    return (
      <GlassContainer spacing={spacing} style={style} onLayout={onLayout}>
        {children}
      </GlassContainer>
    );
  }

  return (
    <NativeView style={style} onLayout={onLayout}>
      {children}
    </NativeView>
  );
}
