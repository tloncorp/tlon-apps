import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import { useContext, useMemo } from 'react';
import { Platform } from 'react-native';

import { useInstalledNavigationOptions } from '../../../navigation/useInstalledNavigationOptions';
import type { SettingsListSearch } from './types';
import { useSettingsListColors } from './useSettingsListColors';

const resetOptions: NativeStackNavigationOptions = {
  headerSearchBarOptions: undefined,
};

/**
 * Puts a settings list's search in the native navigation bar, the way platform
 * settings search. The bar sits under the title rather than in iOS 26's bottom
 * toolbar, which pickers use for their own actions.
 */
export function useNativeHeaderSearch(search: SettingsListSearch | undefined) {
  const navigation = useContext(NavigationContext);
  const enabled = Platform.OS !== 'web' && search !== undefined;
  const onChangeTextRef = useMutableRef(search?.onChangeText);
  const placeholder = search?.placeholder;
  const { primaryText, tertiaryText } = useSettingsListColors();

  const options = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerSearchBarOptions: {
        placeholder,
        placement: 'stacked',
        hideWhenScrolling: false,
        // The SwiftUI form doesn't follow the layout change when iOS hides the
        // title to search, and leaves its rows under the field; results show in
        // the list itself, so it needn't dim either.
        hideNavigationBar: false,
        obscureBackground: false,
        autoCapitalize: 'none',
        // Android draws the search icon and text white unless told otherwise,
        // which vanishes on a light header.
        ...(Platform.OS === 'android'
          ? {
              headerIconColor: primaryText,
              textColor: primaryText,
              hintTextColor: tertiaryText,
            }
          : {}),
        onChangeText: (event) =>
          onChangeTextRef.current?.(event.nativeEvent.text),
        onCancelButtonPress: () => onChangeTextRef.current?.(''),
        onClose: () => onChangeTextRef.current?.(''),
      },
    }),
    [onChangeTextRef, placeholder, primaryText, tertiaryText]
  );

  useInstalledNavigationOptions(navigation, options, enabled, resetOptions);
}
