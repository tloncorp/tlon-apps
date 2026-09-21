import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { ColorTokens, useTheme } from 'tamagui';

import {
  type ScreenHeaderAction,
  type ScreenHeaderActionPresentation,
  attachLatestScreenHeaderActionCallbacks,
} from './actions';
import { NativeHeaderBadgeButton } from './NativeHeaderBadgeButton';
import { ScreenHeaderItemElements } from './primitives';

/**
 * One declaration per header button, from which every platform representation
 * is derived: native `unstable_header*Items` descriptors on iOS, React
 * controls inside the native header on Android, and React controls in the web
 * ScreenHeader. Screens declare buttons once instead of keeping platform forms
 * in sync.
 */

export type ThemeValues = ReturnType<typeof useTheme>;

/** UIBarButtonItem gained a badge in iOS 26; earlier systems ignore it. */
export function supportsNativeHeaderBadge(
  platform: string = Platform.OS,
  version: string | number = Platform.Version
) {
  return platform === 'ios' && Number.parseInt(String(version), 10) >= 26;
}

export function resolveNativeHeaderColor(
  color: ColorTokens | string | undefined,
  theme: ThemeValues
) {
  if (!color) {
    return undefined;
  }

  if (!color.startsWith('$')) {
    return color;
  }

  const themeKey = color.slice(1);
  const themeValue = (
    theme as unknown as Record<string, { val?: string } | undefined>
  )[themeKey];
  return themeValue?.val;
}

const noop = () => {};

export function buildNativeHeaderItem(
  action: ScreenHeaderAction
): NativeStackHeaderItem {
  if ('items' in action) {
    return {
      type: 'menu',
      label: action.label,
      accessibilityLabel: action.label,
      icon: {
        type: 'image',
        source: { uri: `TlonHeader${action.icon}` },
      },
      identifier: action.testID ?? action.id,
      sharesBackground: true,
      menu: {
        items: action.items.map((item) => ({
          type: 'action' as const,
          label: item.label,
          onPress: item.onPress,
          destructive: item.destructive,
        })),
      },
    } as NativeStackHeaderItem;
  }

  if ('text' in action) {
    return {
      type: 'button',
      label: action.text,
      accessibilityLabel: action.text,
      identifier: action.testID ?? action.id,
      onPress: action.onPress ?? noop,
      disabled: action.disabled,
      sharesBackground: true,
      tintColor: action.tint,
    };
  }

  if (action.badge != null && !supportsNativeHeaderBadge()) {
    // UIBarButtonItem badges exist from iOS 26. Earlier systems ignore the
    // property, and because the native header is still in use the React
    // header never mounts, so the count would simply vanish. Host a React
    // button as a custom item instead.
    return {
      type: 'custom',
      element: (
        <NativeHeaderBadgeButton
          iconUri={`TlonHeader${action.icon}`}
          label={action.label}
          badge={action.badge}
          tint={action.tint}
          onPress={action.onPress ?? noop}
          disabled={action.disabled}
          testID={action.testID ?? action.id}
        />
      ),
    } as NativeStackHeaderItem;
  }

  return {
    type: 'button',
    label: action.label,
    accessibilityLabel: action.label,
    icon: {
      type: 'image',
      source: { uri: `TlonHeader${action.icon}` },
    },
    identifier: action.testID ?? action.id,
    onPress: action.onPress ?? noop,
    disabled: action.disabled,
    sharesBackground: true,
    tintColor: action.tint,
    // UIBarButtonItem badges exist from iOS 26; earlier systems ignore this
    // and the React header draws its own. The badge takes the tint so a count
    // reads as part of the lit icon rather than a second colour beside it.
    ...(action.badge != null
      ? {
          badge: {
            value: action.badge,
            ...(action.tint ? { style: { backgroundColor: action.tint } } : {}),
          },
        }
      : {}),
  } as NativeStackHeaderItem;
}

export function buildNativeHeaderActionOptions({
  side,
  presentation,
  actionsRef,
}: {
  side: 'left' | 'right';
  presentation: ScreenHeaderActionPresentation[];
  actionsRef: { current: ScreenHeaderAction[] };
}) {
  const actions = attachLatestScreenHeaderActionCallbacks(
    presentation,
    actionsRef
  );

  if (Platform.OS === 'ios') {
    return {
      [`unstable_header${side === 'left' ? 'Left' : 'Right'}Items`]: () =>
        actions.map((action) => buildNativeHeaderItem(action)),
    };
  }

  return {
    [`header${side === 'left' ? 'Left' : 'Right'}`]: () => (
      <ScreenHeaderItemElements actions={actions} nativeHeader />
    ),
  };
}
