import { config } from './tamagui.config';

export type Conf = typeof config;

// Sets up typing for tamagui so that theme variables autocomplete
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}

  interface TypeOverride {
    groupNames(): 'button';
  }
}
