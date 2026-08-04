import type { ReactNode } from 'react';

import type { ScreenHeaderAction } from './screenHeaderItemModel';

export interface UseScreenHeaderOptions {
  enabled: boolean;
  title: string;
  titleElement: ReactNode;
  usesCustomTitle: boolean;
  backgroundColor?: string;
  left: ScreenHeaderAction[];
  right: ScreenHeaderAction[];
}
