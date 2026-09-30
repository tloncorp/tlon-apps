import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useMutableRef } from '@tloncorp/shared';
import { useContext, useMemo } from 'react';
import { Platform } from 'react-native';

import { useInstalledNavigationOptions } from '../../../navigation/useInstalledNavigationOptions';
import type { SettingsListSearch } from './types';

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

  const options = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerSearchBarOptions: {
        placeholder,
        placement: 'stacked',
        hideWhenScrolling: false,
        autoCapitalize: 'none',
        onChangeText: (event) =>
          onChangeTextRef.current?.(event.nativeEvent.text),
        onCancelButtonPress: () => onChangeTextRef.current?.(''),
        onClose: () => onChangeTextRef.current?.(''),
      },
    }),
    [onChangeTextRef, placeholder]
  );

  useInstalledNavigationOptions(navigation, options, enabled, resetOptions);
}
