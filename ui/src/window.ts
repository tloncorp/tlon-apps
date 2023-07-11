import { Rope } from './types/hark';

declare global {
  interface Window {
    ship: string;
    desk: string;
    our: string;
    scroller?: string;
    bootstrapApi: boolean;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    markRead: Rope;
    recents: any;
    colorscheme: any;
  }
}

export {};
