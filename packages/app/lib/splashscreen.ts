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
    // Web needs actual data before showing UI, so no timeout for database task.
    // Native uses 5 second timeout as a nice-to-have.
    const timeout =
      Platform.OS === 'web' && task === SplashScreenTask.startDatabase
        ? undefined // No timeout - wait for actual data
        : 5000; // Keep 5s timeout for other tasks/platforms
    progressManager.add(task, timeout);
  });

  return progressManager;
})();
