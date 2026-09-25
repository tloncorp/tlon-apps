import type { ReactElement, ReactNode } from 'react';

import type { ActionGroup } from './ActionSheet';

export type ExpoSwiftUISheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss?: () => void;
  children: ReactNode;
};

export type ExpoSwiftUIActionContentProps = {
  title: string;
  subtitle?: string;
  icon?: ReactElement;
  onBack?: () => void;
  actionGroups: ActionGroup[];
};

export type ExpoSwiftUIPaneStackProps = {
  selected: 'initial' | 'notifications' | 'sort';
  onSelectionChange: (selected: 'initial' | 'notifications' | 'sort') => void;
  initial: ReactNode;
  notifications: ReactNode;
  sort?: ReactNode;
};
