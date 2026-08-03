import { getTokenValue } from 'tamagui';

import { getTopLevelTabBarContentInset } from './topLevelTabBarMetrics';

export function useTopLevelTabBarContentInset() {
  return getTopLevelTabBarContentInset('web', 0, getTokenValue('$l', 'space'));
}
