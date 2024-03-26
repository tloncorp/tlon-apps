import { registerDevMenuItems } from 'expo-dev-menu';

import { purgeDb } from './nativeDb';

const devMenuItems = [
  {
    name: 'Delete local database',
    callback: () => purgeDb(),
  },
];

registerDevMenuItems(devMenuItems);
