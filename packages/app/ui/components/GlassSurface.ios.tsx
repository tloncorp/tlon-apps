import { BlurView } from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { ComponentProps, PropsWithChildren } from 'react';
import {
  View as NativeView,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native';

type GlassViewProps = ComponentProps<typeof GlassView>;
type GlassSurfaceProps = PropsWithChildren<
  ViewProps &
    Pick<GlassViewProps, 'glassEffectStyle' | 'isInteractive' | 'tintColor'> & {
      fallbackStyle?: StyleProp<ViewStyle>;
      fallbackVisible?: boolean;
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
      />
    );
  }

  return fallbackVisible ? (
    <BlurView
      {...viewProps}
      tint="systemMaterial"
      intensity={90}
      style={fallbackStyle ? [style, fallbackStyle] : style}
    />
  ) : null;
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
