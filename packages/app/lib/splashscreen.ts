import { ProgressManager } from '@tloncorp/shared/utils';
import { Platform } from 'react-native';

export enum SplashScreenTask {
  loadTheme = 'loadTheme',
  startDatabase = 'startDatabase',
}

export const splashScreenProgress = new ProgressManager<SplashScreenTask>(
  new Set<SplashScreenTask>(
    Platform.select({
      web: [SplashScreenTask.loadTheme, SplashScreenTask.startDatabase],
      default: [SplashScreenTask.loadTheme],
    })
  )
);
