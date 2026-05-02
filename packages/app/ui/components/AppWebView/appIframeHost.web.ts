// Persistent iframe host (web only).
//
// Mounting and unmounting an embedded Urbit app inside a screen would force
// the iframe to reload on every visit. Instead, we keep one iframe per cache
// key alive in a top-level fixed-position container and sync its bounding box
// to a placeholder slot rendered by the screen. When the screen unmounts, we
// just hide the iframe — its state is preserved.

interface CachedIframe {
  iframe: HTMLIFrameElement;
  src: string;
  loaded: boolean;
  loadListeners: Set<() => void>;
}

const iframes = new Map<string, CachedIframe>();
let hostContainer: HTMLDivElement | null = null;

function getHost(): HTMLDivElement {
  if (!hostContainer) {
    hostContainer = document.createElement('div');
    hostContainer.setAttribute('data-app-iframe-host', '');
    hostContainer.style.position = 'fixed';
    hostContainer.style.top = '0';
    hostContainer.style.left = '0';
    hostContainer.style.width = '0';
    hostContainer.style.height = '0';
    hostContainer.style.pointerEvents = 'none';
    // Iframes are appended to <body> as siblings of the React root, so we
    // pin them low in the stacking order; in-app overlays (Leap, sheets)
    // can claim higher z-index values.
    hostContainer.style.zIndex = '0';
    document.body.appendChild(hostContainer);
  }
  return hostContainer;
}

function getOrCreate(key: string, src: string): CachedIframe {
  const entry = iframes.get(key);
  if (entry && entry.src === src) {
    return entry;
  }
  if (entry && entry.iframe.parentNode) {
    entry.iframe.parentNode.removeChild(entry.iframe);
  }

  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.style.position = 'fixed';
  iframe.style.border = 'none';
  iframe.style.background = 'transparent';
  iframe.style.display = 'none';
  iframe.style.zIndex = '0';
  getHost().appendChild(iframe);

  const created: CachedIframe = {
    iframe,
    src,
    loaded: false,
    loadListeners: new Set(),
  };
  iframe.addEventListener('load', () => {
    created.loaded = true;
    created.loadListeners.forEach((fn) => fn());
  });
  iframes.set(key, created);
  return created;
}

export interface AppIframeHandle {
  isLoaded: () => boolean;
  onLoad: (cb: () => void) => () => void;
  detach: () => void;
}

export function mountAppIframe(
  key: string,
  src: string,
  slot: HTMLElement
): AppIframeHandle {
  const entry = getOrCreate(key, src);
  const { iframe } = entry;

  iframe.style.display = 'block';
  iframe.style.pointerEvents = 'auto';

  const sync = () => {
    if (!slot.isConnected) return;
    const rect = slot.getBoundingClientRect();
    iframe.style.left = `${rect.left}px`;
    iframe.style.top = `${rect.top}px`;
    iframe.style.width = `${rect.width}px`;
    iframe.style.height = `${rect.height}px`;
  };
  sync();

  const ro =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
  ro?.observe(slot);
  ro?.observe(document.body);
  window.addEventListener('resize', sync);
  window.addEventListener('scroll', sync, true);

  let detached = false;
  return {
    isLoaded: () => entry.loaded,
    onLoad: (cb) => {
      if (entry.loaded) {
        const id = window.setTimeout(cb, 0);
        return () => window.clearTimeout(id);
      }
      entry.loadListeners.add(cb);
      return () => entry.loadListeners.delete(cb);
    },
    detach: () => {
      if (detached) return;
      detached = true;
      ro?.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
      iframe.style.display = 'none';
      iframe.style.pointerEvents = 'none';
    },
  };
}
