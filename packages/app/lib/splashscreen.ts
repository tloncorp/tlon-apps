import { ProgressManager } from '@tloncorp/shared/utils';

export enum SplashScreenTask {
  initialSync = 'initialSync',
  loadTheme = 'loadTheme',
  startDatabase = 'startDatabase',
}

export const splashScreenProgress = new ProgressManager<SplashScreenTask>(
  new Set<SplashScreenTask>([SplashScreenTask.loadTheme])
);
