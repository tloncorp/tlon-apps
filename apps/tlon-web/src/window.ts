import type { NativeWebViewOptions } from '@tloncorp/shared';
import { Rope } from '@tloncorp/shared/urbit/hark';

declare global {
  interface Window {
    ship: string;
    desk: string;
    our: string;
    scroller?: string;
    bootstrapApi: boolean;
    toggleDevTools: () => void;
    unread: any;
    markRead: Rope;
    regeneratorRuntime: any;
    recents: any;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    nativeOptions?: NativeWebViewOptions;
    // old values for backwards compatibility with Tlon Mobile v3
    colorscheme: any;
    safeAreaInsets?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  }
}

export {};
