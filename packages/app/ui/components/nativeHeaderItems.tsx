import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { ColorTokens, useTheme } from 'tamagui';

import { nativeHeaderIcons } from '../../navigation/nativeHeaderIcons';
import { ScreenHeaderItemElements } from './ScreenHeaderItemElements';
import {
  forwardLatestHeaderItemCallbacks,
  getScreenHeaderItemSignature,
  visibleHeaderItemConfigs,
} from './screenHeaderItemModel';
import type { ScreenHeaderItemConfig } from './screenHeaderItemModel';

/**
 * One declaration per header button, from which every platform representation
 * is derived: native `unstable_header*Items` descriptors on iOS, React
 * controls inside the native header on Android, and React controls in the web
 * ScreenHeader. Screens declare buttons once instead of keeping platform forms
 * in sync.
 */

export type ThemeValues = ReturnType<typeof useTheme>;

export const nativeIconSources = {
  Add: nativeHeaderIcons.add,
  AddPerson: nativeHeaderIcons.invite,
  ChevronLeft: nativeHeaderIcons.back,
  EditList: nativeHeaderIcons.editList,
  Overflow: nativeHeaderIcons.overflow,
  RightSidebar: nativeHeaderIcons.rightSidebar,
  Search: nativeHeaderIcons.search,
  Settings: nativeHeaderIcons.settings,
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
  config: ScreenHeaderItemConfig,
  theme: ThemeValues
): NativeStackHeaderItem {
  if ('menu' in config) {
    return {
      type: 'menu',
      label: config.menu.label,
      accessibilityLabel: config.menu.label,
      icon: {
        type: 'image',
        source: nativeIconSources[config.menu.icon],
      },
      identifier: config.id,
      sharesBackground: true,
      menu: {
        items: config.menu.items.map((item) => ({
          type: 'action' as const,
          label: item.label,
          onPress: item.onPress,
        })),
      },
    } as NativeStackHeaderItem;
  }

  if ('text' in config) {
    return {
      type: 'button',
      label: config.text,
      accessibilityLabel: config.text,
      identifier: config.id,
      onPress: config.onPress ?? noop,
      disabled: config.disabled,
      sharesBackground: true,
      tintColor: resolveNativeHeaderColor(config.tint, theme),
    };
  }

  return {
    type: 'button',
    label: config.label,
    accessibilityLabel: config.label,
    icon: {
      type: 'image',
      source: nativeIconSources[config.icon],
    },
    identifier: config.id,
    onPress: config.onPress ?? noop,
    disabled: config.disabled,
    selected: config.selected,
    sharesBackground: true,
    tintColor: resolveNativeHeaderColor(config.tint, theme),
  } as NativeStackHeaderItem;
}

export function buildNativeHeaderItems(
  configs: ScreenHeaderItemConfig[],
  theme: ThemeValues
): { items: NativeStackHeaderItem[]; signature: string } {
  const visible = visibleHeaderItemConfigs(configs);
  const items = visible.map((config) => buildNativeHeaderItem(config, theme));
  const signature = getScreenHeaderItemSignature(configs, (color) =>
    resolveNativeHeaderColor(color, theme)
  );
  return { items, signature };
}

/**
 * Applies ScreenHeader's item descriptors as `unstable_header*Items` on iOS
 * and RN elements via `headerLeft`/`headerRight` on Android. `options` is
 * merged into the same `setOptions` call and should be memoized by the caller.
 * `revision` forces a re-apply for custom content the signature cannot see.
 */
export function useNativeHeaderItems({
  navigation,
  enabled = true,
  left,
  right,
  options,
  resetOptions,
  revision,
}: {
  navigation:
    | {
        setOptions(options: object): void;
        isFocused?(): boolean;
      }
    | null
    | undefined;
  enabled?: boolean;
  left: ScreenHeaderItemConfig[];
  right: ScreenHeaderItemConfig[];
  options?: object;
  resetOptions?: object;
  revision?: unknown;
}) {
  const theme = useTheme();

  const leftConfigsRef = useRef<ScreenHeaderItemConfig[]>([]);
  const rightConfigsRef = useRef<ScreenHeaderItemConfig[]>([]);
  const themeRef = useRef(theme);
  leftConfigsRef.current = left;
  rightConfigsRef.current = right;
  themeRef.current = theme;

  const signature = [
    buildNativeHeaderItems(leftConfigsRef.current, theme).signature,
    buildNativeHeaderItems(rightConfigsRef.current, theme).signature,
  ].join('|');

  const payload = useMemo(() => {
    // Reference the stand-ins for the ref-read configs directly so the
    // dependency list stays honest without disabling the lint rule: these two
    // values are what force a re-apply when config content changes.
    void signature;
    void revision;
    const next: Record<string, unknown> = { ...(options ?? {}) };

    function applySide(
      configsRef: { current: ScreenHeaderItemConfig[] },
      nativeKey: string,
      elementKey: string
    ) {
      if (Platform.OS === 'ios') {
        next[nativeKey] = () =>
          buildNativeHeaderItems(
            forwardLatestHeaderItemCallbacks(configsRef),
            themeRef.current
          ).items;
      } else {
        next[elementKey] = () => (
          <ScreenHeaderItemElements
            configs={forwardLatestHeaderItemCallbacks(configsRef)}
            nativeHeader
          />
        );
      }
    }

    applySide(leftConfigsRef, 'unstable_headerLeftItems', 'headerLeft');
    applySide(rightConfigsRef, 'unstable_headerRightItems', 'headerRight');

    return next;
  }, [options, revision, signature]);

  useLayoutEffect(() => {
    if (!enabled || !navigation) {
      return;
    }
    navigation.setOptions(payload);
  }, [enabled, navigation, payload]);

  useLayoutEffect(() => {
    if (!enabled || !navigation || !resetOptions) {
      return;
    }
    return () => {
      if (navigation.isFocused == null || navigation.isFocused()) {
        navigation.setOptions(resetOptions);
      }
    };
  }, [enabled, navigation, resetOptions]);
}
