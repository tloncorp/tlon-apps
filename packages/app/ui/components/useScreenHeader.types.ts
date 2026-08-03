import type { ReactNode } from 'react';

import type { ScreenHeaderItemConfig } from './screenHeaderItemModel';

export interface UseScreenHeaderOptions {
  enabled: boolean;
  title: string;
  titleElement: ReactNode;
  usesCustomTitle: boolean;
  backgroundColor?: string;
  left: ScreenHeaderItemConfig[];
  right: ScreenHeaderItemConfig[];
  revision?: unknown;
}
