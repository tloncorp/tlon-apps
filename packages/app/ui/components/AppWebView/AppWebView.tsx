import { LoadingSpinner } from '@tloncorp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { View } from 'tamagui';

import { mountAppIframe } from './appIframeHost';

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

function LoadingOverlay() {
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (paused) return;
    const slot = slotRef.current;
    if (!slot) return;
    const handle = mountAppIframe(cacheKey, path, slot);
    setLoaded(handle.isLoaded());
    const unsubscribe = handle.onLoad(() => setLoaded(true));
    return () => {
      unsubscribe();
      handle.detach();
    };
  }, [cacheKey, path, paused]);

  return (
    <View flex={1} backgroundColor="$background">
      <div ref={slotRef} style={{ flex: 1, width: '100%', height: '100%' }} />
      {!loaded && !paused && <LoadingOverlay />}
    </View>
  );
}

function AppWebViewNative({ shipUrl, path }: AppWebViewProps) {
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);

  if (!shipUrl) {
    return (
      <View flex={1} backgroundColor="$background">
        <LoadingOverlay />
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
      {!loaded && <LoadingOverlay />}
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
