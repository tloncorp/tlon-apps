import type { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { ComponentProps, PropsWithChildren } from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
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

/** Platform-neutral surface; iOS supplies the Liquid Glass implementation. */
export function GlassSurface({
  fallbackStyle,
  fallbackVisible = true,
  glassEffectStyle: _glassEffectStyle,
  isInteractive: _isInteractive,
  tintColor: _tintColor,
  children,
  overlay,
  style,
  ...viewProps
}: GlassSurfaceProps) {
  if (!fallbackVisible) {
    return null;
  }

  if (!overlay) {
    return (
      <View
        {...viewProps}
        style={fallbackStyle ? [style, fallbackStyle] : style}
      >
        {children}
      </View>
    );
  }

  return (
    <View {...viewProps} style={style}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, style, fallbackStyle]}
      />
      {children}
      {overlay}
    </View>
  );
}

export function GlassSurfaceGroup({
  spacing: _spacing,
  ...viewProps
}: PropsWithChildren<ViewProps & { spacing?: number }>) {
  return <View {...viewProps} />;
}
