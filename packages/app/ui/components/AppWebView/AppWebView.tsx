import { LoadingSpinner } from '@tloncorp/ui';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { createPortal } from 'react-dom';
import { WebView } from 'react-native-webview';
import { Spinner, View, useTheme } from 'tamagui';

import { mountAppIframe } from './appIframeHost';

// Minimum time the loading spinner stays visible after a fresh iframe mount.
// Avoids a sub-frame flash when the embedded app's document loads very fast.
const SPINNER_MIN_DURATION_MS = 400;

interface AppWebViewProps {
  // Required on native (the WebView needs an absolute URL); on web we use the
  // current origin since the Tlon web app is served by the same ship.
  shipUrl?: string;
  // Path to load on the ship, relative to its origin (e.g. '/apps/landscape/'
  // or '/notes/?notebook=...&embed=1'). Should already include a query string
  // if needed.
  path: string;
  // Identity for iframe caching on web. Two AppWebViews with the same key
  // will share an iframe across mount/unmount cycles, preserving state.
  cacheKey: string;
  // When true, detach the iframe (display: none + observers off). Used while
  // the host screen is unfocused on desktop so ResizeObserver bursts during
  // drawer transitions don't thrash layout. The cached iframe is preserved.
  paused?: boolean;
}

function PortalLoadingOverlay({
  rect,
  background,
  spinnerColor,
}: {
  rect: { left: number; top: number; width: number; height: number } | null;
  background: string;
  spinnerColor: string;
}) {
  if (!rect) return null;
  // Mounted as a direct child of <body> so we don't get trapped inside any
  // tamagui portal target / drawer transform stacking context. The body-
  // level iframe host sits at zIndex 0; this beats it cleanly. Theme
  // tokens are resolved upstream and passed in as plain colors so the
  // portal contents don't depend on the theme being reachable.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <Spinner color={spinnerColor} />
    </div>,
    document.body
  );
}

function InlineLoadingOverlay() {
  return (
    <View
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      justifyContent="center"
      alignItems="center"
      backgroundColor="$background"
      pointerEvents="none"
    >
      <LoadingSpinner />
    </View>
  );
}

function AppWebViewWeb({ path, cacheKey, paused }: AppWebViewProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [overlayRect, setOverlayRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const theme = useTheme();
  const overlayBackground = theme.background?.val ?? '#ffffff';
  const spinnerColor =
    theme.tertiaryText?.val ?? theme.color?.val ?? '#6b7280';

  // Run synchronously after DOM commit but before paint, so the spinner is
  // present on the very first visible frame instead of waiting for a
  // post-paint useEffect to fire.
  useLayoutEffect(() => {
    if (paused) {
      setShowSpinner(false);
      setOverlayRect(null);
      return;
    }
    const slot = slotRef.current;
    if (!slot) return;
    const handle = mountAppIframe(cacheKey, path, slot);
    if (handle.isLoaded()) {
      setShowSpinner(false);
      setOverlayRect(null);
      return () => handle.detach();
    }

    const startedAt = Date.now();
    const sync = () => {
      if (!slot.isConnected) return;
      const r = slot.getBoundingClientRect();
      setOverlayRect({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    };
    sync();
    setShowSpinner(true);

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(slot);
    ro?.observe(document.body);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);

    const unsubscribe = handle.onLoad(() => {
      const remaining = Math.max(
        0,
        SPINNER_MIN_DURATION_MS - (Date.now() - startedAt)
      );
      hideTimer = setTimeout(() => {
        setShowSpinner(false);
        setOverlayRect(null);
      }, remaining);
    });

    return () => {
      unsubscribe();
      handle.detach();
      ro?.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [cacheKey, path, paused]);

  return (
    <View flex={1} backgroundColor="$background">
      <div ref={slotRef} style={{ flex: 1, width: '100%', height: '100%' }} />
      {showSpinner && (
        <PortalLoadingOverlay
          rect={overlayRect}
          background={overlayBackground}
          spinnerColor={spinnerColor}
        />
      )}
    </View>
  );
}

function AppWebViewNative({ shipUrl, path }: AppWebViewProps) {
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);

  if (!shipUrl) {
    return (
      <View flex={1} backgroundColor="$background">
        <InlineLoadingOverlay />
      </View>
    );
  }

  const base = shipUrl.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return (
    <View flex={1} backgroundColor="$background">
      <WebView
        source={{ uri: url }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1 }}
        onLoadEnd={handleLoad}
        onShouldStartLoadWithRequest={(request) =>
          request.url.startsWith(base)
        }
      />
      {!loaded && <InlineLoadingOverlay />}
    </View>
  );
}

export function AppWebView(props: AppWebViewProps) {
  return Platform.OS === 'web' ? (
    <AppWebViewWeb {...props} />
  ) : (
    <AppWebViewNative {...props} />
  );
}
