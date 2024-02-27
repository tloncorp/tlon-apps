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
