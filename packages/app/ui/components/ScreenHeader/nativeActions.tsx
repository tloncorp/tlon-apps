import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { ColorTokens, useTheme } from 'tamagui';

import {
  type ScreenHeaderAction,
  type ScreenHeaderActionPresentation,
  attachLatestScreenHeaderActionCallbacks,
} from './actions';
import { ScreenHeaderItemElements } from './primitives';

/**
 * One declaration per header button, from which every platform representation
 * is derived: native `unstable_header*Items` descriptors on iOS, React
 * controls inside the native header on Android, and React controls in the web
 * ScreenHeader. Screens declare buttons once instead of keeping platform forms
 * in sync.
 */

export type ThemeValues = ReturnType<typeof useTheme>;

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
  if (action.kind === 'menu') {
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
        })),
      },
    } as NativeStackHeaderItem;
  }

  if (action.kind === 'text') {
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
    selected: action.selected,
    sharesBackground: true,
    tintColor: action.tint,
  } as NativeStackHeaderItem;
}

export function buildNativeHeaderItems(
  actions: ScreenHeaderAction[]
): NativeStackHeaderItem[] {
  return actions.map((action) => buildNativeHeaderItem(action));
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
        buildNativeHeaderItems(actions),
    };
  }

  return {
    [`header${side === 'left' ? 'Left' : 'Right'}`]: () => (
      <ScreenHeaderItemElements actions={actions} nativeHeader />
    ),
  };
}
