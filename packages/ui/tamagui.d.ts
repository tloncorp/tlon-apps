import type { Conf } from './tamagui.config';

export type { Conf };

// Sets up typing for tamagui so that theme variables autocomplete
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}

  interface TypeOverride {
    groupNames(): 'button';
  }
}
