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
