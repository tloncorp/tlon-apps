import { Rope } from './types/hark';

declare global {
  interface Window {
    ship: string;
    desk: string;
    our: string;
    scroller?: string;
    bootstrapApi: boolean;
    toggleDevTools: () => void;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    markRead: Rope;
    recents: any;
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
