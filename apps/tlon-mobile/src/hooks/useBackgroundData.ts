import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

const BackgroundDataLoader = NativeModules.BackgroundDataLoader;

export function useBackgroundData() {
  useEffect(() => {
    if (Platform.OS === 'ios' && BackgroundDataLoader) {
      BackgroundDataLoader.retrieveBackgroundData()
        .then((data: string) => {
          console.log('bl: retreived raw data', data);
          const structuredData = JSON.parse(data);
          console.log('bl: structured data', structuredData);
        })
        .catch((e: Error) => {
          console.log('bl: failed to retrieve background data', e);
        });
    } else {
      console.log(`bl: no BackgroundDataLoader module found`);
    }
  }, []);
}
