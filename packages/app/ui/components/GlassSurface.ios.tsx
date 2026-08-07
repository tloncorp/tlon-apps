import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { ComponentProps, PropsWithChildren } from 'react';
import {
  View as NativeView,
  StyleProp,
  StyleSheet,
  ViewProps,
  ViewStyle,
} from 'react-native';

type GlassViewProps = ComponentProps<typeof GlassView>;
type GlassSurfaceProps = PropsWithChildren<
  ViewProps &
    Pick<GlassViewProps, 'glassEffectStyle' | 'isInteractive' | 'tintColor'> & {
      fallbackStyle?: StyleProp<ViewStyle>;
      fallbackVisible?: boolean;
      overlay?: ReactNode;
    }
>;

function canUseLiquidGlass() {
  return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}

/** Liquid Glass with a single shared blur fallback. */
export function GlassSurface({
  fallbackStyle,
  fallbackVisible = true,
  glassEffectStyle,
  isInteractive,
  tintColor,
  children,
  overlay,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  if (canUseLiquidGlass()) {
    return (
      <GlassView
        {...viewProps}
        glassEffectStyle={glassEffectStyle}
        isInteractive={isInteractive}
        tintColor={tintColor}
        style={style}
      >
        {children}
        {overlay}
      </GlassView>
    );
  }

  if (!fallbackVisible) {
    return null;
  }

  if (!overlay) {
    return (
      <BlurView
        {...viewProps}
        tint="systemMaterial"
        intensity={90}
        style={fallbackStyle ? [style, fallbackStyle] : style}
      >
        {children}
      </BlurView>
    );
  }

  return (
    <NativeView {...viewProps} style={style}>
      <BlurView
        pointerEvents="none"
        tint="systemMaterial"
        intensity={90}
        style={[StyleSheet.absoluteFill, style, fallbackStyle]}
      />
      {children}
      {overlay}
    </NativeView>
  );
}

export function GlassSurfaceGroup({
  spacing,
  ...viewProps
}: PropsWithChildren<ViewProps & { spacing?: number }>) {
  return canUseLiquidGlass() ? (
    <GlassContainer {...viewProps} spacing={spacing} />
  ) : (
    <NativeView {...viewProps} />
  );
}
