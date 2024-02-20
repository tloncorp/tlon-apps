import type { config } from '@tloncorp/ui';

export type Conf = typeof config;

// Sets up typing for tamagui so that theme variables autocomplete
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
