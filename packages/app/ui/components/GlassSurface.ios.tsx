import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { ComponentProps, PropsWithChildren } from 'react';
import { View as NativeView, ViewProps } from 'react-native';

type GlassViewProps = ComponentProps<typeof GlassView>;
type GlassSurfaceProps = PropsWithChildren<
  ViewProps &
    Pick<GlassViewProps, 'glassEffectStyle' | 'isInteractive' | 'tintColor'>
>;

export function supportsLiquidGlass() {
  return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
}

/** Liquid Glass when available, otherwise a regular view. */
export function GlassSurface({
  glassEffectStyle,
  isInteractive,
  tintColor,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  if (supportsLiquidGlass()) {
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

  return <NativeView {...viewProps} style={style} />;
}

export function GlassSurfaceGroup({
  spacing,
  ...viewProps
}: PropsWithChildren<ViewProps & { spacing?: number }>) {
  return supportsLiquidGlass() ? (
    <GlassContainer {...viewProps} spacing={spacing} />
  ) : (
    <NativeView {...viewProps} />
  );
}
