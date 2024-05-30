import AsyncStorage from '@react-native-async-storage/async-storage';

import { VolumeUpdate, queryClient } from '../api';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';

const logger = createDevLogger('keyValueStore', true);

export const VOLUME_SETTINGS_QUERY_KEY = ['activity', 'volumeSettings'];

export async function storeVolumeSettings(volumeSettings: ub.VolumeSettings) {
  await AsyncStorage.setItem('volumeSettings', JSON.stringify(volumeSettings));
  queryClient.invalidateQueries({ queryKey: VOLUME_SETTINGS_QUERY_KEY });
  logger.log('stored volume settings');
}

export async function getVolumeSettings(): Promise<ub.VolumeSettings> {
  const settings = await AsyncStorage.getItem('volumeSettings');
  return settings ? JSON.parse(settings) : {};
}

export async function mergeVolumeSettings(
  updates: VolumeUpdate[]
): Promise<ub.VolumeSettings> {
  const currentSettings = await getVolumeSettings();
  const newSettings = updates.reduce((acc, { sourceId, volume }) => {
    acc[sourceId] = volume;
    return acc;
  }, {} as ub.VolumeSettings);
  const merged = { ...currentSettings, ...newSettings };
  await storeVolumeSettings(merged);
  logger.log('merged volume settings', merged);
  return merged;
}
