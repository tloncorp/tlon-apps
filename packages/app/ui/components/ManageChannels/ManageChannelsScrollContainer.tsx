// Platform-specific implementations will be chosen by the bundler:
// - ManageChannelsScrollContainer.native.tsx for React Native
// - ManageChannelsScrollContainer.web.tsx for Web
// This file exists only to satisfy TypeScript imports under
// `pnpm --filter @tloncorp/app tsc`, which does not resolve `.native.tsx`.

export {
  ManageChannelsScrollContainer,
  useManageChannelsScrollRef,
} from './ManageChannelsScrollContainer.web';
