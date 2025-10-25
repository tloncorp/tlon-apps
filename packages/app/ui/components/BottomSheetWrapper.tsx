// This file acts as a fallback for platforms that don't have specific implementations
// It will be overridden by .native.tsx on React Native and .web.tsx on web
export {
  BottomSheetWrapper,
  BottomSheetScrollView,
  BottomSheetTextInput
} from './BottomSheetWrapper.web';