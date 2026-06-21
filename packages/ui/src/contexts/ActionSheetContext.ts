import { createContext } from 'react';

// Context to detect when components are inside an ActionSheet
// Used to automatically fix issues with Pressable in ActionSheets on Android
export const ActionSheetContext = createContext<{
  isInsideSheet: boolean;
  // The resolved adaptive mode of the enclosing ActionSheet. Sheet.ScrollView
  // requires a <Sheet> ancestor, which only exists in 'sheet' mode; consumers
  // (ActionSheet.ScrollableContent) use this to avoid rendering it otherwise.
  mode?: 'sheet' | 'dialog' | 'popover';
}>({
  isInsideSheet: false,
});
