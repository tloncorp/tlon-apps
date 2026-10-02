import type { ReactElement, ReactNode } from 'react';

import type { ActionGroup } from './ActionSheet';

export type ExpoUISheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss?: () => void;
  children: ReactNode;
};

export type ExpoUIActionContentProps = {
  title: string;
  subtitle?: string;
  icon?: ReactElement;
  onBack?: () => void;
  actionGroups: ActionGroup[];
};

export type ExpoUIPaneStackProps = {
  selected: 'initial' | 'notifications' | 'sort';
  onSelectionChange: (selected: 'initial' | 'notifications' | 'sort') => void;
  initial: ReactNode;
  notifications: ReactNode;
  sort?: ReactNode;
};
