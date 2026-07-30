import type { NativeStackHeaderItem } from '@react-navigation/native-stack';
import { Button, Icon, useIsWindowNarrow } from '@tloncorp/ui';
import {
  ComponentProps,
  ReactElement,
  forwardRef,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { ColorTokens, TamaguiElement, XStack, useTheme } from 'tamagui';

import { nativeHeaderIcons } from '../../navigation/nativeHeaderIcons';
import { ActionSheet } from './ActionSheet';
import { HeaderIconButton, HeaderTextButton } from './ScreenHeaderPrimitives';

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

export function forwardLatestHeaderItemCallbacks(configsRef: {
  current: NativeHeaderItemConfig[];
}): NativeHeaderItemConfig[] {
  return configsRef.current.map((config) => {
    if ('element' in config) {
      return config;
    }

    if ('menu' in config) {
      const id = config.id;
      return {
        ...config,
        menu: {
          ...config.menu,
          items: config.menu.items.map((item, index) => ({
            ...item,
            onPress: () => {
              const latest = configsRef.current.find(
                (candidate) => candidate.id === id && 'menu' in candidate
              );
              if (latest && 'menu' in latest) {
                latest.menu.items[index]?.onPress();
              }
            },
          })),
        },
      };
    }

    const id = config.id;
    return {
      ...config,
      onPress: () => {
        const latest = configsRef.current.find(
          (candidate) =>
            candidate.id === id &&
            !('element' in candidate) &&
            !('menu' in candidate)
        );
        if (
          latest &&
          !('element' in latest) &&
          !('menu' in latest) &&
          !latest.disabled
        ) {
          latest.onPress?.();
        }
      },
    };
  });
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
        return `menu:${config.id}:${config.menu.icon}:${config.menu.items
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
 * React rendering of the same configs, used by the web ScreenHeader and inside
 * the Android native header via `headerLeft`/`headerRight`.
 */
export function HeaderItemElements({
  configs,
  nativeHeader = false,
}: {
  configs: NativeHeaderItemConfig[];
  nativeHeader?: boolean;
}) {
  const visible = visibleConfigs(configs);
  if (visible.length === 0) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      height={nativeHeader ? '$4xl' : undefined}
      gap={nativeHeader ? '$l' : undefined}
    >
      {visible.map((config) => {
        if ('element' in config) {
          return <XStack key={config.id}>{config.element}</XStack>;
        }
        if ('menu' in config) {
          return <HeaderItemMenu key={config.id} config={config} />;
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

function HeaderItemMenu({ config }: { config: HeaderMenuItemConfig }) {
  const [open, setOpen] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();

  return (
    <ActionSheet
      mode={isWindowNarrow ? 'sheet' : 'popover'}
      modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <HeaderItemMenuTrigger
          icon={config.menu.icon}
          aria-label={config.menu.label}
          onPress={isWindowNarrow ? () => setOpen(true) : undefined}
        />
      }
    >
      <ActionSheet.Content>
        <ActionSheet.ActionGroup accent="neutral">
          {config.menu.items.map((item) => (
            <ActionSheet.Action
              key={item.label}
              action={{
                title: item.label,
                action: () => {
                  setOpen(false);
                  item.onPress();
                },
              }}
            />
          ))}
        </ActionSheet.ActionGroup>
      </ActionSheet.Content>
    </ActionSheet>
  );
}

const HeaderItemMenuTrigger = forwardRef<
  TamaguiElement,
  ComponentProps<typeof Button.Frame> & { icon: NativeHeaderIconName }
>(function HeaderItemMenuTrigger({ icon, ...props }, ref) {
  return (
    <Button.Frame ref={ref} fill="text" intent="secondary" {...props}>
      <Icon type={icon} color="$secondaryText" />
    </Button.Frame>
  );
});

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
  left: NativeHeaderItemConfig[];
  right: NativeHeaderItemConfig[];
  options?: object;
  resetOptions?: object;
  revision?: unknown;
}) {
  const theme = useTheme();

  const leftConfigsRef = useRef<NativeHeaderItemConfig[]>([]);
  const rightConfigsRef = useRef<NativeHeaderItemConfig[]>([]);
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
      configsRef: { current: NativeHeaderItemConfig[] },
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
          <HeaderItemElements
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
