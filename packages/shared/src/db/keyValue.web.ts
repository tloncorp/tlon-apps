import AsyncStorage from '@react-native-async-storage/async-storage';

import { VolumeUpdate, queryClient } from '../api';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';

// TODO: add local storage based solution for web

const logger = createDevLogger('keyValueStore', false);

export async function storeVolumeSettings() {
  // TODO
}

export async function getVolumeSettings() {
  // TOOD
}

export async function mergeVolumeSettings(updates: VolumeUpdate[]) {
  // TODO
}
