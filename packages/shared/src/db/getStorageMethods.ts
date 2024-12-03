import AsyncStorage from '@react-native-async-storage/async-storage';

export function getStorageMethods(isSecure: boolean) {
  if (isSecure) {
    // TODO: secure implementation for web
    return {
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
    };
  }

  return {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  };
}
