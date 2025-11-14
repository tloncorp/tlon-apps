// Platform-specific implementations will be chosen by the bundler:
// - BottomSheetWrapper.native.tsx for React Native
// - BottomSheetWrapper.web.tsx for Web
// This file exists only to satisfy TypeScript imports

// Re-export from web version for TypeScript type checking
// The actual implementation used will depend on the platform
export {
  BottomSheetWrapper,
  BottomSheetScrollView,
  BottomSheetTextInput
} from './BottomSheetWrapper.web';