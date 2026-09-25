import { createContext } from 'react';

// Context to detect when components are inside an ActionSheet
// Used to automatically fix issues with Pressable in ActionSheets on Android
export const ActionSheetContext = createContext<{
  isInsideSheet: boolean;
  mode?: 'sheet' | 'dialog' | 'popover';
  nativePresentation?: boolean;
}>({
  isInsideSheet: false,
});
