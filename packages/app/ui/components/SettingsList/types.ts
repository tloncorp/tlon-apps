import type { IconType } from '@tloncorp/ui';
import type { ReactElement } from 'react';

export type SettingsRowLeading =
  | { kind: 'icon'; icon: IconType }
  | { kind: 'contact'; contactId: string }
  /**
   * Plain React Native content, such as an avatar, drawn at the size the list
   * gives it; native lists host it in a frame of that size.
   */
  | {
      kind: 'element';
      render: (options: { size: number; compact: boolean }) => ReactElement;
    };

export type SettingsContextAction = {
  key: string;
  title: string;
  onPress: () => void;
};

/**
 * One settings row, described as data so each platform can draw it with its
 * own list: a SwiftUI form on iOS, a Compose list on Android, Tamagui on web.
 */
export interface SettingsRowModel {
  key: string;
  title: string;
  /** A secondary line under the title, such as a name or a short explanation. */
  subtitle?: string;
  /** The setting's current value, shown the way each platform shows values. */
  value?: string;
  leading?: SettingsRowLeading;
  /** A larger row for an identity: your profile, or your bot. */
  prominent?: boolean;
  /** Marks an edit that is staged but not yet applied. */
  pending?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  /**
   * A command that runs in place, such as exporting logs. Drawn in the accent
   * color, without a chevron.
   */
  action?: boolean;
  /**
   * Marks one choice among its section's rows. A row that sets it, true or
   * false, is a choice: it shows a checkmark when selected, never a chevron.
   */
  selected?: boolean;
  /**
   * How the end of a pressable row reads: a chevron for a pushed screen, an
   * arrow for something outside the app, or nothing when pressing asks first,
   * such as a confirmation. Defaults to a chevron.
   */
  accessory?: 'chevron' | 'external' | 'none';
  onPress?: () => void;
  /**
   * Long-press actions. iOS lists them in a context menu; Android and web run
   * the first one directly.
   */
  contextActions?: SettingsContextAction[];
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
  /**
   * An editable single-line value, such as a URL or token. The row shows the
   * field in place of its title, which still labels it for accessibility, so
   * give the section a title that says what the value is.
   */
  textField?: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    /** Masks the value, for secrets. */
    secure?: boolean;
    /** Defaults to none, for URLs and keys; names want `words`. */
    capitalization?: 'none' | 'words' | 'sentences';
    /** Hears focus coming and going, for screens that commit when editing ends. */
    onFocusChange?: (focused: boolean) => void;
    /** Gives the keyboard a Done key that runs this. */
    onSubmit?: () => void;
  };
  /** Desktop highlight for the row whose screen is open beside the list. */
  isFocused?: boolean;
  testID?: string;
}

export interface SettingsSectionModel {
  key: string;
  title?: string;
  footer?: string;
  rows: SettingsRowModel[];
}

export interface SettingsListProps {
  sections: SettingsSectionModel[];
}

/** A search over a settings list, kept in the screen's own state. */
export interface SettingsListSearch {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}
