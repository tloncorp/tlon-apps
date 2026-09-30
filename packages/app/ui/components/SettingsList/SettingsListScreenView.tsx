import { LoadingSpinner, useIsWindowNarrow } from '@tloncorp/ui';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { View } from 'tamagui';

import { TextInput } from '../Form';
import { ScreenHeader, type ScreenHeaderAction } from '../ScreenHeader';
import { SettingsList } from './SettingsList';
import { getSettingsListHeaderColor } from './settingsListHeaderColor';
import { settingsListPageColor } from './settingsListPageColor';
import type { SettingsListSearch, SettingsSectionModel } from './types';
import { useNativeHeaderSearch } from './useNativeHeaderSearch';

/**
 * A pushed settings screen: its header over a settings list, with an optional
 * bar pinned below. Wide windows show the screen beside the list that opened
 * it, so they get no back button.
 */
export function SettingsListScreenView({
  title,
  sections,
  onBackPressed,
  showsBackOnWideWindows = false,
  rightActions,
  loadingSubtitle,
  loading = false,
  search,
  bottomBar,
  children,
}: {
  title: string;
  sections: SettingsSectionModel[];
  onBackPressed: () => void;
  /** For a step inside the screen, whose back button leads to the last step. */
  showsBackOnWideWindows?: boolean;
  rightActions?: ScreenHeaderAction[];
  /** A note under the title while the list refreshes. */
  loadingSubtitle?: string | null;
  /** Shows a spinner in place of the list until there is something to list. */
  loading?: boolean;
  /** Native screens search from the navigation bar; web gets a field. */
  search?: SettingsListSearch;
  bottomBar?: ReactNode;
  /** Anything else the screen mounts, such as its dialogs. */
  children?: ReactNode;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  useNativeHeaderSearch(loading ? undefined : search);
  // SwiftUI moves its own form clear of the keyboard; the Compose list only
  // learns about the keyboard by being resized, which the app's keyboard
  // controller leaves to views like this one.
  const avoidsKeyboard =
    Platform.OS === 'android' &&
    !loading &&
    sections.some((section) => section.rows.some((row) => row.textField));

  return (
    <View flex={1} backgroundColor={settingsListPageColor}>
      <ScreenHeader
        title={title}
        backgroundColor={getSettingsListHeaderColor()}
        backAction={
          isWindowNarrow || showsBackOnWideWindows ? onBackPressed : undefined
        }
        rightActions={rightActions}
        loadingSubtitle={loadingSubtitle}
        borderBottom
        placement="navigation"
      />
      {search && !loading && Platform.OS === 'web' ? (
        <View paddingHorizontal="$l" paddingTop="$l">
          <TextInput
            value={search.value}
            placeholder={search.placeholder}
            onChangeText={search.onChangeText}
          />
        </View>
      ) : null}
      {avoidsKeyboard ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <SettingsList sections={sections} />
        </KeyboardAvoidingView>
      ) : (
        <View flex={1}>
          {loading ? (
            <View flex={1} alignItems="center" justifyContent="center">
              <LoadingSpinner />
            </View>
          ) : (
            <SettingsList sections={sections} />
          )}
        </View>
      )}
      {bottomBar}
      {children}
    </View>
  );
}
