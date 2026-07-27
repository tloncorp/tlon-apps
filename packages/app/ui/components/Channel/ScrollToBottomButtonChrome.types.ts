import type { PropsWithChildren } from 'react';

export type ScrollToBottomButtonChromeProps = PropsWithChildren<{
  onPress: () => void;
  visible: boolean;
}>;
