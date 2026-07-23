import type { NativeTabParamList } from './types';

export function getNativeTabRoute<T extends keyof NativeTabParamList>(
  screen: T,
  params: NativeTabParamList[T]
) {
  return {
    name: 'MainTabs' as const,
    params: {
      screen,
      params,
    },
  };
}
