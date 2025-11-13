import { createDevLogger } from '@tloncorp/shared';
import { ProgressManager } from '@tloncorp/shared/utils';
import { Platform } from 'react-native';

const logger = createDevLogger('splashProgress', false);

export enum SplashScreenTask {
  loadTheme = 'loadTheme',
  startDatabase = 'startDatabase',
}

export const splashScreenProgress = (() => {
  const progressManager = new ProgressManager<SplashScreenTask>(new Set());

  // Setup tasks on progress manager
  const taskConfigs = Platform.select({
    web: [
      [SplashScreenTask.loadTheme, 5000],
      // Web needs actual data before showing UI, so no timeout for database task
      [SplashScreenTask.startDatabase, undefined],
    ] as Array<[SplashScreenTask, number | undefined]>,
    default: [[SplashScreenTask.loadTheme, 5000]] as Array<
      [SplashScreenTask, number | undefined]
    >,
  });

  taskConfigs?.forEach(([task, timeout]) => {
    progressManager.add(task, timeout);
  });

  return progressManager;
})();

splashScreenProgress.emitter.on('complete', () => {
  logger.trackEvent('SplashScreen progress complete');
});
