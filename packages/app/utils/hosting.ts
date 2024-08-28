import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const setHostingToken = async (token: string) => {
  await SecureStore.setItemAsync('hostingToken', token);
};

export const getHostingToken = () => {
  return SecureStore.getItemAsync('hostingToken');
};

export const setHostingUserId = async (userId: string) => {
  await SecureStore.setItemAsync('hostingUserId', userId);
};

export const getHostingUserId = () => {
  return SecureStore.getItemAsync('hostingUserId');
};

export const removeHostingToken = async () => {
  await SecureStore.deleteItemAsync('hostingToken');
};

export const removeHostingUserId = async () => {
  await SecureStore.deleteItemAsync('hostingUserId');
};

export async function getHostingAuthExpired() {
  const value = await AsyncStorage.getItem('hosting:hostingAuthExpired');
  return value === 'true';
}

export async function setHostingAuthExpired(value: boolean) {
  await AsyncStorage.setItem('hosting:hostingAuthExpired', String(value));
}

export async function getLastHostingAuthCheck() {
  const value = await AsyncStorage.getItem('hosting:lastAuthCheck');
  return Number(value);
}

export async function setLastHostingAuthCheck(value: number) {
  await AsyncStorage.setItem('hosting:lastAuthCheck', String(value));
}
