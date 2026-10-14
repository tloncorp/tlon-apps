import { Icon } from '@tloncorp/ui';
import type { ComponentProps, PropsWithChildren } from 'react';
import {
  Pressable,
  View,
  type AccessibilityState,
  type ViewStyle,
} from 'react-native';
import { useTheme, useThemeName } from 'tamagui';

import {
  GlassSurface,
  supportsLiquidGlass,
} from '../../ui/components/GlassSurface';

function ControlSurface({
  children,
  grouped = false,
}: PropsWithChildren<{ grouped?: boolean }>) {
  const theme = useTheme();
  const glass = supportsLiquidGlass();
  const themeName = useThemeName();
  const style: ViewStyle = {
    borderRadius: grouped ? 28 : 22,
    ...(grouped
      ? { flexDirection: 'row', padding: 4, gap: 4, maxWidth: '100%' }
      : { width: 44, height: 44 }),
    ...(!glass
      ? {
          backgroundColor: theme.background.val,
          shadowColor: theme.primaryText.val,
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }
      : {}),
  };
  return (
    <GlassSurface
      glassEffectStyle="regular"
      tintColor={theme.background.val}
      colorScheme={themeName.startsWith('dark') ? 'dark' : 'light'}
      isInteractive
      style={style}
    >
      {children}
    </GlassSurface>
  );
}

export function BrowserControlGroup({ children }: PropsWithChildren) {
  return <ControlSurface grouped>{children}</ControlSurface>;
}

export function BrowserControlButton({
  icon,
  accessibilityLabel,
  accessibilityState,
  disabled = false,
  grouped = false,
  onPress,
}: {
  icon: ComponentProps<typeof Icon>['type'];
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  grouped?: boolean;
  onPress: () => void;
}) {
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed && !disabled ? '#80808020' : 'transparent',
      })}
    >
      <Icon
        type={icon}
        customSize={[24, 24]}
        color={disabled ? '$tertiaryText' : '$primaryText'}
      />
    </Pressable>
  );
  return grouped ? button : <ControlSurface>{button}</ControlSurface>;
}

// The SwiftUI Menu owns interaction and accessibility for this label.
export function BrowserControlMenuLabel() {
  return (
    <View pointerEvents="none" accessibilityElementsHidden>
      <ControlSurface>
        <View
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon type="Overflow" customSize={[24, 24]} color="$primaryText" />
        </View>
      </ControlSurface>
    </View>
  );
}
