import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { GetStorageMethods } from './types';

export const getStorageMethods: GetStorageMethods = (isSecure: boolean) => {
  if (isSecure) {
    return {
      getItem: SecureStore.getItemAsync,
      setItem: async (key: string, value: string) => {
        // This deletion should be temporary -- we just want to be sure that all
        // keys are initially set with the correct `keychainAccessible` option.
        // see issue here: https://github.com/expo/expo/issues/23924
        try {
          await SecureStore.deleteItemAsync(key);
        } catch (e) {
          // ignore error -- we don't care if it can't be deleted because it doesn't exist
        }
        return SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      },
      removeItem: SecureStore.deleteItemAsync,
    };
  }

  return {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
    removeItem: AsyncStorage.removeItem,
  };
};
