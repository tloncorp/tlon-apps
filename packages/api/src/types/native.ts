export interface NativeWebViewOptions {
  colorScheme?: 'light' | 'dark' | null;
  hideTabBar?: boolean;
  isUsingTlonAuth?: boolean;
  safeAreaInsets?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export type MobileNavTab = 'Groups' | 'Messages' | 'Activity' | 'Profile';

export interface GotoMessage {
  action: 'goto';
  path: string;
}

export interface NativeTabChange {
  action: 'nativeTabChange';
  tab: MobileNavTab;
}

export type NativeCommand = GotoMessage | NativeTabChange;

export type WebAppAction =
  | 'copy'
  | 'logout'
  | 'manageAccount'
  | 'appLoaded'
  | 'activeTabChange'
  | 'saveLastPath';
export interface ActiveTabChange {
  action: 'activeTabChange';
  value: MobileNavTab;
}
export interface SaveLastPath {
  action: 'saveLastPath';
  value: {
    tab: 'Groups' | 'Messages';
    path: string;
  };
}
export type WebAppCommand = ActiveTabChange | SaveLastPath;
