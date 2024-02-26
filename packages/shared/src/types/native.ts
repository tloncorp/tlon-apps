export interface NativeWebViewOptions {
  colorScheme?: "light" | "dark" | null;
  hideTabBar?: boolean;
  safeAreaInsets?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export type MobileNavTab = "Groups" | "Messages" | "Activity" | "Profile";

export interface GotoMessage {
  action: "goto";
  path: string;
}
export type NativeCommand = GotoMessage;

export type WebAppAction =
  | "copy"
  | "logout"
  | "manageAccount"
  | "appLoaded"
  | "activeTabChange";
export interface ActiveTabChange {
  action: "activeTabChange";
  value: MobileNavTab;
}
export type WebAppCommand = ActiveTabChange;
