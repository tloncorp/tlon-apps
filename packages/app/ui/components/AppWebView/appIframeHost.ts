// Native stub. The persistent-iframe technique only applies to web; native
// uses a real WebView that's mounted/unmounted per screen.

export interface AppIframeHandle {
  isLoaded: () => boolean;
  onLoad: (cb: () => void) => () => void;
  getTitle: () => string | null;
  detach: () => void;
}

export function mountAppIframe(
  _key: string,
  _src: string,
  _slot: unknown
): AppIframeHandle {
  throw new Error('mountAppIframe is web-only');
}
