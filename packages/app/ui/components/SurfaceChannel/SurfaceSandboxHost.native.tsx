import { useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';

import type { SurfaceSandboxHostProps } from './SurfaceSandboxHost';
import { SandboxSession, createSandboxSession } from './sandboxSession';

/**
 * Native (iOS/Android) sandbox host — WRITTEN BUT UNVERIFIED. Every
 * behavior that can only be proven on a device carries a
 * SURFACE-NATIVE-VERIFY marker; the session report lists them all as a
 * device checklist. Do not treat this file as providing enforced egress
 * blocking until those markers are cleared.
 */
export function SurfaceSandboxHost(props: SurfaceSandboxHostProps) {
  const webviewRef = useRef<WebView | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);

  const latest = useRef({
    state: props.state,
    theme: props.theme,
    canInvoke: props.canInvoke,
    onInvoke: props.onInvoke,
    onShellError: props.onShellError,
  });
  latest.current.onInvoke = props.onInvoke;
  latest.current.onShellError = props.onShellError;

  const { document: sandboxDocument, spec } = props;
  useEffect(() => {
    const session = createSandboxSession({
      spec,
      initialState: latest.current.state,
      theme: latest.current.theme,
      canInvoke: latest.current.canInvoke,
      post: (serialized) => {
        // SURFACE-NATIVE-VERIFY(transport): inbound delivery to the page
        // dispatches a window MessageEvent via injectJavaScript instead of
        // WebView.postMessage, because RN WebView's postMessage has
        // historically targeted `document` on iOS and `window` on Android
        // while the shell listens on `window`. Must be proven on both
        // platforms: the shell receives init/state/theme/permission.
        webviewRef.current?.injectJavaScript(
          `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
            serialized
          )} })); true;`
        );
      },
      onInvoke: (actionId) => latest.current.onInvoke(actionId),
      onShellError: (phase, message) =>
        latest.current.onShellError?.(phase, message),
    });
    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
    };
  }, [sandboxDocument, spec]);

  useEffect(() => {
    latest.current.state = props.state;
    sessionRef.current?.updateState(props.state);
  }, [props.state]);
  useEffect(() => {
    latest.current.theme = props.theme;
    sessionRef.current?.updateTheme(props.theme);
  }, [props.theme]);
  useEffect(() => {
    latest.current.canInvoke = props.canInvoke;
    sessionRef.current?.updatePermission(props.canInvoke);
  }, [props.canInvoke]);

  return (
    <WebView
      ref={webviewRef}
      // SURFACE-NATIVE-VERIFY(srcdoc/baseUrl): source={{html}} loads with
      // an about:blank-ish base; prove on device that the document loads,
      // the CSP meta applies, and no baseUrl grants an origin.
      source={{ html: sandboxDocument }}
      originWhitelist={['about:blank']}
      // SURFACE-NATIVE-VERIFY(egress): this only vetoes NAVIGATIONS, not
      // subresource requests. Real deny-all egress requires
      // WKContentRuleList (iOS) / shouldInterceptRequest (Android) at the
      // native layer per plan §5 — neither is expressible through
      // react-native-webview props today. Until a native module lands and
      // is leak-tested on device, the CSP meta inside the document is the
      // only resource-level gate here.
      onShouldStartLoadWithRequest={(request) =>
        request.url === 'about:blank' ||
        request.url.startsWith('data:text/html')
      }
      onMessage={(event) => {
        sessionRef.current?.handleInbound(event.nativeEvent.data);
      }}
      // SURFACE-NATIVE-VERIFY(capabilities): prove on device that these
      // leave no storage/file/media reachable from the sandbox document.
      javaScriptEnabled
      domStorageEnabled={false}
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      allowsInlineMediaPlayback={false}
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
      // eslint-disable-next-line react-native/no-inline-styles
      style={{ flex: 1 }}
    />
  );
}
