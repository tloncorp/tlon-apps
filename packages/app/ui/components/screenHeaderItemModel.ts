export type ScreenHeaderIconName =
  | 'Add'
  | 'AddPerson'
  | 'ChevronLeft'
  | 'EditList'
  | 'Overflow'
  | 'RightSidebar'
  | 'Search'
  | 'Settings';

interface BaseItemConfig {
  /** Stable identity for the native item; also the default testID. */
  id: string;
  /** Excluded from every platform representation when false. */
  visible?: boolean;
}

export interface HeaderIconItemConfig extends BaseItemConfig {
  icon: ScreenHeaderIconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Theme token (`$positiveActionText`) or raw color. */
  tint?: string;
  /** React-rendered header highlight behind the icon. */
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
    icon: ScreenHeaderIconName;
    label: string;
    items: { label: string; onPress: () => void }[];
  };
}

export type ScreenHeaderItemConfig =
  | HeaderIconItemConfig
  | HeaderTextItemConfig
  | HeaderMenuItemConfig;

export function visibleHeaderItemConfigs(configs: ScreenHeaderItemConfig[]) {
  return configs.filter((config) => config.visible !== false);
}

export function forwardLatestHeaderItemCallbacks(configsRef: {
  current: ScreenHeaderItemConfig[];
}): ScreenHeaderItemConfig[] {
  return configsRef.current.map((config) => {
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
          (candidate) => candidate.id === id && !('menu' in candidate)
        );
        if (latest && !('menu' in latest) && !latest.disabled) {
          latest.onPress?.();
        }
      },
    };
  });
}

export function getScreenHeaderItemSignature(
  configs: ScreenHeaderItemConfig[],
  resolveColor: (color: string | undefined) => string | undefined
) {
  return visibleHeaderItemConfigs(configs)
    .map((config) => {
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
        resolveColor(config.tint) ?? '',
        'backgroundTint' in config ? config.backgroundTint ?? '' : '',
      ].join(':');
    })
    .join(',');
}
