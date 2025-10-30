import AsyncStorage from '@react-native-async-storage/async-storage';

import { GetStorageMethods } from './types';

export const getStorageMethods: GetStorageMethods = () => ({
  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  removeItem: AsyncStorage.removeItem,
});
