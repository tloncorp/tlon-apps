// Native stub. The persistent-iframe technique only applies to web; native
// uses a real WebView that's mounted/unmounted per screen.

export interface NotesIframeHandle {
  isLoaded: () => boolean;
  onLoad: (cb: () => void) => () => void;
  detach: () => void;
}

export function mountNotesIframe(
  _key: string,
  _src: string,
  _slot: unknown
): NotesIframeHandle {
  throw new Error('mountNotesIframe is web-only');
}
