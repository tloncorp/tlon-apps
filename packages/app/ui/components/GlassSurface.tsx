import type { GlassView } from 'expo-glass-effect';
import { ComponentProps, PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';

type GlassViewProps = ComponentProps<typeof GlassView>;
type GlassSurfaceProps = PropsWithChildren<
  ViewProps &
    Pick<GlassViewProps, 'glassEffectStyle' | 'isInteractive' | 'tintColor'>
>;

export function supportsLiquidGlass() {
  return false;
}

/** Platform-neutral surface; iOS supplies the Liquid Glass implementation. */
export function GlassSurface({
  glassEffectStyle: _glassEffectStyle,
  isInteractive: _isInteractive,
  tintColor: _tintColor,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  return <View {...viewProps} style={style} />;
}

export function GlassSurfaceGroup({
  spacing: _spacing,
  ...viewProps
}: PropsWithChildren<ViewProps & { spacing?: number }>) {
  return <View {...viewProps} />;
}
