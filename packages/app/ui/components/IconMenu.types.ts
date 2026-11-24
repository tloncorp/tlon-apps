import type { ReactNode } from 'react';

import type { SettingsMenuItem } from './SettingsList/types';

/** A command in the menu, as in the settings list's menus. */
export type IconMenuItem = SettingsMenuItem & {
  /** Draws a separator above this command, to start a new group. */
  separatorBefore?: boolean;
};

export interface IconMenuProps {
  /**
   * What is pressed to open the menu. It must not take presses itself, or the
   * native menu around it never opens.
   */
  children: ReactNode;
  items: IconMenuItem[];
  /**
   * Web has no menu here; pressing runs this instead. Callers that keep their
   * own web menu, like the overflow menus, leave it out.
   */
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
}
