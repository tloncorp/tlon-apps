import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDevLogger } from '../debug';

const logger = createDevLogger('keyValueStore', true);

export type ChannelSortPreference = 'recency' | 'arranged';
export async function storeChannelSortPreference(
  sortPreference: ChannelSortPreference
) {
  try {
    await AsyncStorage.setItem('channelSortPreference', sortPreference);
  } catch (error) {
    logger.error('storeChannelSortPreference', error);
  }
}

export async function getChannelSortPreference() {
  try {
    const value = await AsyncStorage.getItem('channelSortPreference');
    return (value ?? 'recency') as ChannelSortPreference;
  } catch (error) {
    logger.error('getChannelSortPreference', error);
  }
}
