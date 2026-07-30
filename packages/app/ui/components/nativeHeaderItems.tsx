import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { ReactElement, useLayoutEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { ColorTokens, XStack, useTheme } from 'tamagui';

import { nativeHeaderIcons } from '../../navigation/nativeHeaderIcons';
import { HeaderIconButton, HeaderTextButton } from './ScreenHeaderPrimitives';

/**
 * One declaration per header button, from which every platform representation
 * is derived: native `unstable_header*Items` descriptors on iOS, RN elements
 * rendered inside the native header on Android. Screens declare buttons once
 * as data instead of hand-writing both forms and keeping them in sync.
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

export type NativeHeaderIconName = keyof typeof nativeIconSources;

interface BaseItemConfig {
  /** Stable identity for the native item; also the default testID. */
  id: string;
  /** Excluded from both representations when false. Defaults to true. */
  visible?: boolean;
}

export interface HeaderIconItemConfig extends BaseItemConfig {
  icon: NativeHeaderIconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Theme token (`$positiveActionText`) or raw color. */
  tint?: string;
  /** RN-only background highlight behind the icon. */
  backgroundTint?: string;
  testID?: string;
}

export interface HeaderTextItemConfig extends BaseItemConfig {
  text: string;
  onPress?: () => void;
  disabled?: boolean;
  tint?: string;
  testID?: string;
}

export interface HeaderMenuItemConfig extends BaseItemConfig {
  menu: {
    icon: NativeHeaderIconName;
    label: string;
    items: { label: string; onPress: () => void }[];
  };
}

export interface HeaderElementItemConfig extends BaseItemConfig {
  element: ReactElement;
}

export type NativeHeaderItemConfig =
  | HeaderIconItemConfig
  | HeaderTextItemConfig
  | HeaderMenuItemConfig
  | HeaderElementItemConfig;

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

function visibleConfigs(configs: NativeHeaderItemConfig[]) {
  return configs.filter((config) => config.visible !== false);
}

export function buildNativeHeaderItem(
  config: NativeHeaderItemConfig,
  theme: ThemeValues
): NativeStackHeaderItem {
  if ('element' in config) {
    return {
      type: 'custom',
      element: config.element,
    };
  }

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
  configs: NativeHeaderItemConfig[],
  theme: ThemeValues
): { items: NativeStackHeaderItem[]; signature: string } {
  const visible = visibleConfigs(configs);
  const items = visible.map((config) => buildNativeHeaderItem(config, theme));
  const signature = visible
    .map((config) => {
      if ('element' in config) {
        return `custom:${config.id}`;
      }
      if ('menu' in config) {
        return `menu:${config.id}:${config.menu.items
          .map((item) => item.label)
          .join(';')}`;
      }
      const kind = 'text' in config ? `text:${config.text}` : config.icon;
      return [
        config.id,
        kind,
        config.disabled ? 'disabled' : 'enabled',
        'selected' in config && config.selected ? 'selected' : '',
        resolveNativeHeaderColor(config.tint, theme) ?? '',
        'backgroundTint' in config ? config.backgroundTint ?? '' : '',
      ].join(':');
    })
    .join(',');
  return { items, signature };
}

/**
 * RN rendering of the same configs, used inside the Android native header via
 * `headerLeft`/`headerRight`. Menu items have no RN twin today (every current
 * menu usage is iOS-only) and render nothing.
 */
function HeaderItemElements({
  configs,
}: {
  configs: NativeHeaderItemConfig[];
}) {
  const visible = visibleConfigs(configs);
  if (visible.length === 0) {
    return null;
  }

  return (
    <XStack alignItems="center">
      {visible.map((config) => {
        if ('element' in config) {
          return <XStack key={config.id}>{config.element}</XStack>;
        }
        if ('menu' in config) {
          return null;
        }
        if ('text' in config) {
          return (
            <HeaderTextButton
              key={config.id}
              onPress={config.disabled ? undefined : config.onPress}
              disabled={config.disabled}
              color={(config.tint as ColorTokens) ?? '$primaryText'}
              testID={config.testID ?? config.id}
            >
              {config.text}
            </HeaderTextButton>
          );
        }
        return (
          <HeaderIconButton
            key={config.id}
            type={config.icon}
            disabled={config.disabled}
            onPress={config.disabled ? undefined : config.onPress}
            color={(config.tint as ColorTokens) ?? '$primaryText'}
            backgroundColor={
              (config.backgroundTint as ColorTokens) ?? 'transparent'
            }
            testID={config.testID ?? config.id}
            aria-label={config.label}
          />
        );
      })}
    </XStack>
  );
}

type HeaderSideConfig = NativeHeaderItemConfig[] | 'clear' | undefined;

/**
 * Declares a screen's native header buttons once and emits the right
 * representation per platform: `unstable_header*Items` on iOS, RN elements via
 * `headerLeft`/`headerRight` on Android.
 *
 * A side that is `undefined` is left untouched; `'clear'` explicitly resets
 * both of that side's option keys (e.g. to restore the system back button
 * after another screen state managed it); an array is managed.
 *
 * `options` is merged into the same `setOptions` call and should be memoized
 * by the caller. `revision` forces a re-apply for content the signature cannot
 * see (e.g. custom elements whose rendering changed).
 */
export function useNativeHeaderItems({
  navigation,
  enabled = true,
  left,
  right,
  title,
  options,
  revision,
}: {
  navigation: { setOptions(options: object): void } | null | undefined;
  enabled?: boolean;
  left?: HeaderSideConfig;
  right?: HeaderSideConfig;
  title?: string;
  options?: object;
  revision?: unknown;
}) {
  const theme = useTheme();

  const leftConfigsRef = useRef<NativeHeaderItemConfig[]>([]);
  const rightConfigsRef = useRef<NativeHeaderItemConfig[]>([]);
  const themeRef = useRef(theme);
  leftConfigsRef.current = left && left !== 'clear' ? left : [];
  rightConfigsRef.current = right && right !== 'clear' ? right : [];
  themeRef.current = theme;

  const leftMode: 'off' | 'clear' | 'managed' =
    left === undefined ? 'off' : left === 'clear' ? 'clear' : 'managed';
  const rightMode: 'off' | 'clear' | 'managed' =
    right === undefined ? 'off' : right === 'clear' ? 'clear' : 'managed';
  const signature = [
    leftMode === 'managed'
      ? buildNativeHeaderItems(leftConfigsRef.current, theme).signature
      : leftMode,
    rightMode === 'managed'
      ? buildNativeHeaderItems(rightConfigsRef.current, theme).signature
      : rightMode,
    title ?? '',
  ].join('|');

  const payload = useMemo(() => {
    // Reference the stand-ins for the ref-read configs directly so the
    // dependency list stays honest without disabling the lint rule: these two
    // values are what force a re-apply when config content changes.
    void signature;
    void revision;
    const next: Record<string, unknown> = { ...(options ?? {}) };
    if (title !== undefined) {
      next.title = title;
    }

    function applySide(
      mode: 'off' | 'clear' | 'managed',
      configsRef: { current: NativeHeaderItemConfig[] },
      nativeKey: string,
      elementKey: string
    ) {
      if (mode === 'off') {
        return;
      }
      if (Platform.OS === 'ios') {
        next[nativeKey] =
          mode === 'clear'
            ? undefined
            : () =>
                buildNativeHeaderItems(configsRef.current, themeRef.current)
                  .items;
      } else {
        next[elementKey] =
          mode === 'clear'
            ? undefined
            : () => <HeaderItemElements configs={configsRef.current} />;
      }
    }

    applySide(leftMode, leftConfigsRef, 'unstable_headerLeftItems', 'headerLeft');
    applySide(
      rightMode,
      rightConfigsRef,
      'unstable_headerRightItems',
      'headerRight'
    );

    return next;
  }, [leftMode, rightMode, options, revision, signature, title]);

  useLayoutEffect(() => {
    if (!enabled || !navigation) {
      return;
    }
    navigation.setOptions(payload);
  }, [enabled, navigation, payload]);
}
