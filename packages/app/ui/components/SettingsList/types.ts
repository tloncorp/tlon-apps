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
  /** The SF Symbol iOS draws beside it, as the system's own menus do. */
  systemImage?: string;
  onPress: () => void;
};

/** A command in an iOS menu. */
export type SettingsMenuItem = SettingsContextAction & {
  destructive?: boolean;
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
  /** A short count drawn as a neutral pill, such as how many entries a list holds. */
  badge?: string;
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
   * With `selected`: several of the section's rows can be chosen at once, so
   * the row is announced as a checkbox rather than one of a set.
   */
  multiple?: boolean;
  /**
   * How the end of a pressable row reads: a chevron for a pushed screen, an
   * arrow for something outside the app, or nothing when pressing asks first,
   * such as a confirmation. Defaults to a chevron.
   */
  accessory?: 'chevron' | 'external' | 'none';
  /**
   * For a title that is prose, such as a description: true shows all of it,
   * false cuts it off after a few lines with "More" beneath, so the row shows
   * it opens. Left out, each list does what it does for a label.
   */
  expanded?: boolean;
  onPress?: () => void;
  /**
   * Long-press actions. iOS lists them in a context menu and Android in a
   * dropdown menu; web runs the first one directly.
   */
  contextActions?: SettingsContextAction[];
  /**
   * A button at the row's end that acts on the row itself, such as removing
   * it from a list. Only the button is tappable, not the whole row.
   */
  trailingAction?: SettingsMenuItem & { testID?: string };
  toggle?: { value: boolean; onValueChange: (value: boolean) => void };
  /**
   * The row's value, picked from a short list: a native menu on iOS and
   * Android, the way Settings shows a choice such as Location access, and a
   * select on web.
   */
  picker?: {
    value: string;
    options: { value: string; title: string }[];
    onChange: (value: string) => void;
  };
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
    /**
     * Makes the field multi-line, showing this many lines, for prose such as
     * a bug report's notes. Longer text scrolls inside the field.
     */
    lines?: number;
    /** The most characters the field takes; typing stops there. */
    maxLength?: number;
    /**
     * Defaults to none, for URLs and keys; names want `words`. Prose wants
     * `sentences`, which also keeps autocorrect on.
     */
    capitalization?: 'none' | 'words' | 'sentences';
    /** Hears focus coming and going, for screens that commit when editing ends. */
    onFocusChange?: (focused: boolean) => void;
    /** Gives the keyboard a Done key that runs this. */
    onSubmit?: () => void;
  };
  /**
   * iOS only, in a section that can be reordered: names the rows after it,
   * like a section's title. One list of headings and rows can stand in for
   * several sections, so a row can be dragged from one group into another.
   * A heading can be dragged too, which moves where its group starts.
   */
  heading?: boolean;
  /** Desktop highlight for the row whose screen is open beside the list. */
  isFocused?: boolean;
  testID?: string;
}

export interface SettingsSectionModel {
  key: string;
  title?: string;
  footer?: string;
  rows: SettingsRowModel[];
  /**
   * React Native content in place of rows, drawn straight on the page with no
   * card, such as a screen's hero. It scrolls with the list.
   */
  element?: ReactElement;
  /** iOS only: a menu opened from beside the section's title. */
  titleMenu?: SettingsMenuItem[];
  /**
   * iOS only: lets the section's rows be dragged into a new order while the
   * list is editing. Hears the rows' old positions and where they went, in
   * the terms of the list before the move.
   */
  onMove?: (from: number[], to: number) => void;
}

export interface SettingsListProps {
  sections: SettingsSectionModel[];
  /**
   * Web only: keeps the rows to a centered column at most this wide, rather
   * than the whole width of a wide window.
   */
  maxWidth?: number;
  /** iOS only: shows the drag handles of sections that can be reordered. */
  editing?: boolean;
  /**
   * iOS only: tighter gaps between sections, for lists of many short
   * sections, such as members grouped by role.
   */
  compactSections?: boolean;
  /**
   * iOS only: hears when the list has scrolled this far from its top, and when
   * it comes back, so a screen can name itself in its bar once its own header
   * has gone under it.
   */
  scrollMark?: SettingsListScrollMark;
}

export interface SettingsListScrollMark {
  offset: number;
  onCrossed: (past: boolean) => void;
}

/** A search over a settings list, kept in the screen's own state. */
export interface SettingsListSearch {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Web only: identifies the search field. */
  testID?: string;
}
