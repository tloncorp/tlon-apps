import type { ReactNode } from 'react';

export interface IconMenuItem {
  key: string;
  title: string;
  /** An SF Symbol shown beside the title in the iOS menu. */
  systemImage?: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface IconMenuProps {
  /** What is pressed to open the menu. */
  children: ReactNode;
  items: IconMenuItem[];
  /** Web has no menu here; pressing runs this instead. */
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}
