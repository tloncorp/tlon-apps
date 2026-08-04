import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { ColorTokens, useTheme } from 'tamagui';

import { ScreenHeaderItemElements } from './ScreenHeaderPrimitives';
import {
  type ScreenHeaderAction,
  forwardLatestScreenHeaderActionCallbacks,
  visibleScreenHeaderActions,
} from './screenHeaderItemModel';

/**
 * One declaration per header button, from which every platform representation
 * is derived: native `unstable_header*Items` descriptors on iOS, React
 * controls inside the native header on Android, and React controls in the web
 * ScreenHeader. Screens declare buttons once instead of keeping platform forms
 * in sync.
 */

export type ThemeValues = ReturnType<typeof useTheme>;

const nativeIconSources = {
  Add: { uri: 'TlonHeaderAdd' },
  AddPerson: { uri: 'TlonHeaderInvite' },
  ChevronLeft: { uri: 'TlonHeaderBack' },
  EditList: { uri: 'TlonHeaderEditList' },
  Overflow: { uri: 'TlonHeaderOverflow' },
  Refresh: { uri: 'TlonHeaderRefresh' },
  RightSidebar: { uri: 'TlonHeaderRightSidebar' },
  Search: { uri: 'TlonHeaderSearch' },
  Settings: { uri: 'TlonHeaderSettings' },
} as const;

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
  action: ScreenHeaderAction,
  theme: ThemeValues
): NativeStackHeaderItem {
  if (action.kind === 'menu') {
    return {
      type: 'menu',
      label: action.label,
      accessibilityLabel: action.label,
      icon: {
        type: 'image',
        source: nativeIconSources[action.icon],
      },
      identifier: action.id,
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
      identifier: action.id,
      onPress: action.onPress ?? noop,
      disabled: action.disabled,
      sharesBackground: true,
      tintColor: resolveNativeHeaderColor(action.tint, theme),
    };
  }

  return {
    type: 'button',
    label: action.label,
    accessibilityLabel: action.label,
    icon: {
      type: 'image',
      source: nativeIconSources[action.icon],
    },
    identifier: action.id,
    onPress: action.onPress ?? noop,
    disabled: action.disabled,
    selected: action.selected,
    sharesBackground: true,
    tintColor: resolveNativeHeaderColor(action.tint, theme),
  } as NativeStackHeaderItem;
}

export function buildNativeHeaderItems(
  actions: ScreenHeaderAction[],
  theme: ThemeValues
): NativeStackHeaderItem[] {
  return visibleScreenHeaderActions(actions).map((action) =>
    buildNativeHeaderItem(action, theme)
  );
}

export function buildNativeHeaderActionOptions({
  side,
  actionsRef,
  themeRef,
}: {
  side: 'left' | 'right';
  actionsRef: { current: ScreenHeaderAction[] };
  themeRef: { current: ThemeValues };
}) {
  if (Platform.OS === 'ios') {
    return {
      [`unstable_header${side === 'left' ? 'Left' : 'Right'}Items`]: () =>
        buildNativeHeaderItems(
          forwardLatestScreenHeaderActionCallbacks(actionsRef),
          themeRef.current
        ),
    };
  }

  return {
    [`header${side === 'left' ? 'Left' : 'Right'}`]: () => (
      <ScreenHeaderItemElements
        actions={forwardLatestScreenHeaderActionCallbacks(actionsRef)}
        nativeHeader
      />
    ),
  };
}
