import { Rope } from './types/hark';

declare global {
  interface Window {
    ship: string;
    desk: string;
    our: string;
    scroller?: string;
    bootstrapApi: boolean;
    ReactNativeWebView?: any;
    markRead: Rope;
    recents: any;
  }
}

export {};
