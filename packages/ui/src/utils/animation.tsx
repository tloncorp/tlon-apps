import { InteractionManager } from 'react-native';
import { runOnJS, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Like `withTiming`, but creates an `InteractionManager` handle to prevent list
 * re-renders while animating
 */

export const interactionWithTiming: typeof withTiming = (value, config, cb) => {
  const handle = InteractionManager.createInteractionHandle();
  return withTiming(value, config, () => {
    if (cb) {
      cb();
    }
    runOnJS(InteractionManager.clearInteractionHandle)(handle);
  });
};
/**
 * Like `withSpring`, but creates an `InteractionManager` handle to prevent list
 * re-renders while animating
 */

export const interactionWithSpring: typeof withSpring = (value, config, cb) => {
  const handle = InteractionManager.createInteractionHandle();
  return withSpring(value, config, () => {
    if (cb) {
      cb();
    }
    runOnJS(InteractionManager.clearInteractionHandle)(handle);
  });
};
