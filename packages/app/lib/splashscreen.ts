import { ProgressManager } from '@tloncorp/shared/utils';
import { Platform } from 'react-native';

export enum SplashScreenTask {
  loadTheme = 'loadTheme',
  startDatabase = 'startDatabase',
}

export const splashScreenProgress = (() => {
  const progressManager = new ProgressManager<SplashScreenTask>(new Set());

  // Setup tasks on progress manager
  Platform.select({
    web: [SplashScreenTask.loadTheme, SplashScreenTask.startDatabase],
    default: [SplashScreenTask.loadTheme],
  }).forEach((task) => {
    // 5 seconds timeout for each task - this assumes that all of the tasks
    // above are strictly "nice-to-haves" and should not block app load.
    progressManager.add(task, 5000);
  });

  return progressManager;
})();
