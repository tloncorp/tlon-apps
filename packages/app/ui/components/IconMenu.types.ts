import type { ReactNode } from 'react';

import type { SettingsMenuItem } from './SettingsList/types';

/** A command in the menu, as in the settings list's menus. */
export type IconMenuItem = SettingsMenuItem;

export interface IconMenuProps {
  /** What is pressed to open the menu. */
  children: ReactNode;
  items: IconMenuItem[];
  /** Web has no menu here; pressing runs this instead. */
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}
