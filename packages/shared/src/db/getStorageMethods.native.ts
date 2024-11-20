import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export function getStorageMethods(isSecure: boolean) {
  if (isSecure) {
    return {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
    };
  }

  return {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  };
}
