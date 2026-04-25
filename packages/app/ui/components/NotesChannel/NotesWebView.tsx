import { LoadingSpinner } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { View } from 'tamagui';

import { mountNotesIframe } from './notesIframeHost';

interface NotesWebViewProps {
  // Required on native (the WebView needs an absolute URL); on web we use the
  // current origin since the Tlon web app is served by the same ship.
  shipUrl?: string;
  notebookFlag?: string;
  hideHeader?: boolean;
}

function buildQuery({ notebookFlag, hideHeader }: NotesWebViewProps) {
  const params = new URLSearchParams();
  if (notebookFlag) params.set('notebook', notebookFlag);
  if (hideHeader) params.set('embed', '1');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
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

function NotesWebViewWeb({ notebookFlag, hideHeader }: NotesWebViewProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Persist one iframe per notebook flag (and per query shape) across screen
  // mounts so navigating away and back doesn't trigger a fresh reload.
  const cacheKey = notebookFlag ?? '__no_notebook__';
  const src = `/notes/${buildQuery({ notebookFlag, hideHeader })}`;

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const handle = mountNotesIframe(cacheKey, src, slot);
    setLoaded(handle.isLoaded());
    const unsubscribe = handle.onLoad(() => setLoaded(true));
    return () => {
      unsubscribe();
      handle.detach();
    };
  }, [cacheKey, src]);

  return (
    <View flex={1} backgroundColor="$background">
      <div ref={slotRef} style={{ flex: 1, width: '100%', height: '100%' }} />
      {!loaded && <LoadingOverlay />}
    </View>
  );
}

function NotesWebViewNative(props: NotesWebViewProps) {
  const query = useMemo(() => buildQuery(props), [props]);
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);

  if (!props.shipUrl) {
    return (
      <View flex={1} backgroundColor="$background">
        <LoadingOverlay />
      </View>
    );
  }

  const base = props.shipUrl.replace(/\/$/, '');
  const url = `${base}/notes/${query}`;
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

export function NotesWebView(props: NotesWebViewProps) {
  return Platform.OS === 'web' ? (
    <NotesWebViewWeb {...props} />
  ) : (
    <NotesWebViewNative {...props} />
  );
}
