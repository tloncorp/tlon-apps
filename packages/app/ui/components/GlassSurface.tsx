import type { GlassView } from 'expo-glass-effect';
import { ComponentProps, PropsWithChildren } from 'react';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';

type GlassViewProps = ComponentProps<typeof GlassView>;
type GlassSurfaceProps = PropsWithChildren<
  ViewProps &
    Pick<GlassViewProps, 'glassEffectStyle' | 'isInteractive' | 'tintColor'> & {
      fallbackStyle?: StyleProp<ViewStyle>;
      fallbackVisible?: boolean;
    }
>;

/** Platform-neutral surface; iOS supplies the Liquid Glass implementation. */
export function GlassSurface({
  fallbackStyle,
  fallbackVisible = true,
  glassEffectStyle: _glassEffectStyle,
  isInteractive: _isInteractive,
  tintColor: _tintColor,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  return fallbackVisible ? (
    <View
      {...viewProps}
      style={fallbackStyle ? [style, fallbackStyle] : style}
    />
  ) : null;
}

export function GlassSurfaceGroup({
  spacing: _spacing,
  ...viewProps
}: PropsWithChildren<ViewProps & { spacing?: number }>) {
  return <View {...viewProps} />;
}
