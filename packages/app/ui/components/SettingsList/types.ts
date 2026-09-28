import type { IconType } from '@tloncorp/ui';
import type { ReactElement } from 'react';

export type SettingsRowLeading =
  | { kind: 'icon'; icon: IconType }
  | { kind: 'contact'; contactId: string }
  /** Plain React Native content, such as an avatar; native lists host it. */
  | { kind: 'element'; element: ReactElement };

export type SettingsContextAction = {
  key: string;
  title: string;
  onPress: () => void;
};

export type SettingsRowStatus = {
  text: string;
  tone: 'positive' | 'warning' | 'neutral';
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
  status?: SettingsRowStatus;
  /** Marks an edit that is staged but not yet applied. */
  pending?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  /** Opens something outside the app instead of pushing a screen. */
  external?: boolean;
  onPress?: () => void;
  /**
   * Long-press actions. iOS lists them in a context menu; Android and web run
   * the first one directly.
   */
  contextActions?: SettingsContextAction[];
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
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
