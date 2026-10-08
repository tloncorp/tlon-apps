import { Text } from '@tloncorp/ui';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { WebView } from 'react-native-webview';
import { YStack } from 'tamagui';

import {
  BrowserControlButton,
  BrowserControlGroup,
} from './BrowserViewerControls.native';

import { BrowserViewerMenu } from './BrowserViewerMenu';

import { trustedBrowserViewerUrl } from './browserCredentialHandoff';

type InputState = {
  ready: boolean;
  keyboardOpen: boolean;
  context: number;
  mode?: 'agent' | 'mobile';
  reloadRequired?: 'agent' | 'mobile' | null;
  browserControlsVisible?: boolean;
};

export function BrowserViewer({
  viewerUrl,
  bottomInset = 0,
  topInset = 0,
  rightInset = 0,
  onLoad,
  onError,
}: {
  viewerUrl: string;
  bottomInset?: number;
  topInset?: number;
  rightInset?: number;
  onLoad: () => void;
  onError: () => void;
}) {
  const uri = trustedBrowserViewerUrl(viewerUrl);
  const webView = useRef<WebView>(null);
  const session = useRef({
    input: null as InputState | null,
    revision: 0,
    pasting: false,
  });
  const [input, setInput] = useState<InputState | null>(null);
  const reloadPrompt = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const send = useCallback((command: object) => {
    // Serialize data as a JS literal; pasted text is never interpreted as code.
    const data = JSON.stringify({ version: 1, ...command })
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    webView.current?.injectJavaScript(
      `window.tlonBrowserInput?.receive(${data}); true;`
    );
  }, []);
  useEffect(() => {
    const lifecycle = session.current;
    // React can reconnect effects without reloading the WebView (including
    // Fast Refresh). Cleanup invalidates our control state, so ask the retained
    // viewer to resend it instead of leaving enabled controls with no target.
    if (lifecycle.revision > 0) send({ type: 'status' });
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      send({ type: 'keyboard', open: false });
    });
    return () => {
      lifecycle.revision++;
      lifecycle.input = null;
      subscription.remove();
      Keyboard.dismiss();
    };
  }, [send]);

  useEffect(() => {
    if (!loaded) return;
    // Reserve the controls' actual footprint only in Mobile View. Steel uses
    // this area both for the displayed canvas and the remote mobile viewport.
    send({
      type: 'insets',
      top: topInset + 68,
      bottom: bottomInset + 80,
      keyboardBottom: 80,
    });
  }, [loaded, topInset, bottomInset, send]);

  const reset = () => {
    session.current.revision++;
    session.current.input = null;
    session.current.pasting = false;
    setInput(null);
    setPasteBusy(false);
    setLoaded(false);
    setNotice(null);
    reloadPrompt.current = null;
  };
  const paste = async () => {
    const target = session.current.input;
    if (!target?.ready || session.current.pasting) return;
    const requestRevision = session.current.revision;
    session.current.pasting = true;
    setPasteBusy(true);
    setNotice(null);
    let text: string | null;
    try {
      text = await Clipboard.getStringAsync();
    } catch {
      text = null;
    }
    if (session.current.revision !== requestRevision) return;
    session.current.pasting = false;
    setPasteBusy(false);
    if (
      !session.current.input?.ready ||
      session.current.input.context !== target.context
    ) {
      setNotice('Browser control changed. Tap Paste again when ready.');
    } else if (text === null) {
      setNotice('Could not read the clipboard. Try Paste again.');
    } else if (!text) {
      setNotice('No text to paste.');
    } else if (text.length > 65_536) {
      setNotice('That text is too long. Copy a smaller selection.');
    } else {
      send({ type: 'paste', text, context: target.context });
    }
  };

  return (
    <YStack flex={1} minHeight={0} backgroundColor="#0b0b0b">
      <WebView
        ref={webView}
        source={{ uri }}
        style={{ flex: 1 }}
        // The streamed canvas owns pan/zoom. Prevent WKWebView from also
        // scrolling its document when the hidden keyboard input is focused.
        scrollEnabled={false}
        bounces={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        // Handle every scheme here rather than handing links to another app.
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) =>
          url === uri || url === 'about:blank'
        }
        onOpenWindow={() => {}}
        javaScriptCanOpenWindowsAutomatically={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        incognito
        cacheEnabled={false}
        mixedContentMode="never"
        allowsInlineMediaPlayback
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        onLoadStart={reset}
        onLoad={() => {
          setLoaded(true);
          send({ type: 'status' });
          onLoad();
        }}
        onMessage={({ nativeEvent }) => {
          if (nativeEvent.url !== uri || nativeEvent.data.length > 8192) return;
          try {
            const status = JSON.parse(nativeEvent.data);
            if (
              status.type !== 'tlon.browser.input' ||
              status.version !== 1 ||
              typeof status.ready !== 'boolean' ||
              typeof status.keyboardOpen !== 'boolean' ||
              !Number.isSafeInteger(status.context) ||
              status.context < 0
            )
              return;
            if (
              status.mode !== undefined &&
              !['agent', 'mobile'].includes(status.mode)
            )
              return;
            if (
              status.browserControlsVisible !== undefined &&
              typeof status.browserControlsVisible !== 'boolean'
            )
              return;
            session.current.input = status;
            setInput(status);
            if (!status.reloadRequired) reloadPrompt.current = null;
            else if (['agent', 'mobile'].includes(status.reloadRequired)) {
              const promptKey = status.reloadRequired;
              if (reloadPrompt.current === promptKey) return;
              reloadPrompt.current = promptKey;
              const target = status.reloadRequired;
              const requestRevision = session.current.revision;
              const change = (mode: 'agent' | 'mobile', reload: boolean) => {
                const current = session.current.input;
                if (
                  !current ||
                  session.current.revision !== requestRevision ||
                  current.reloadRequired !== target
                )
                  return;
                send({
                  type: 'layout',
                  mode,
                  reload,
                  context: current.context,
                });
              };
              Alert.alert(
                'Reload browser page?',
                'Switching views requires reloading this page. Unsubmitted text may be lost.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => change(status.mode ?? 'agent', false),
                  },
                  { text: 'Reload', onPress: () => change(target, true) },
                ],
                { cancelable: false }
              );
            }
          } catch {
            // Unrelated/older viewer messages do not enable native controls.
          }
        }}
        onError={onError}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.url === uri) onError();
        }}
        onContentProcessDidTerminate={onError}
        onRenderProcessGone={onError}
      />
      <BrowserViewerMenu
        topInset={topInset}
        rightInset={rightInset}
        mode={input?.mode}
        ready={!!input?.ready && !!input.mode}
        browserControlsVisible={input?.browserControlsVisible}
        onBrowserControlsChange={(visible) => {
          if (
            typeof session.current.input?.browserControlsVisible !== 'boolean'
          )
            return;
          send({ type: 'browserControls', visible });
        }}
        onSelect={(mode) => {
          const current = session.current.input;
          if (!current?.ready || !current.mode || current.mode === mode) return;
          send({ type: 'layout', mode, context: current.context });
        }}
      />
      <YStack
        position="absolute"
        bottom={16 + (input?.keyboardOpen ? 0 : bottomInset)}
        left={16}
        right={16 + rightInset}
        alignItems="flex-end"
        gap="$s"
        pointerEvents="box-none"
      >
        <BrowserControlGroup>
          <BrowserControlButton
            grouped
            icon={input?.keyboardOpen ? 'ChevronDown' : 'Keyboard'}
            accessibilityLabel={
              input?.keyboardOpen ? 'Hide keyboard' : 'Keyboard'
            }
            disabled={!input?.ready}
            onPress={() => {
              if (!session.current.input?.ready) return;
              const open = !session.current.input.keyboardOpen;
              setNotice(null);
              if (open) webView.current?.requestFocus();
              send({
                type: 'keyboard',
                open,
                context: session.current.input.context,
              });
              if (!open) Keyboard.dismiss();
            }}
          />
          <BrowserControlButton
            grouped
            icon="Clipboard"
            accessibilityLabel="Paste"
            disabled={!input?.ready || pasteBusy}
            onPress={paste}
          />
        </BrowserControlGroup>
        {notice ? (
          <Text padding="$m" borderRadius="$l" backgroundColor="$background">
            {notice}
          </Text>
        ) : loaded && !input?.ready ? (
          <Text padding="$m" borderRadius="$l" backgroundColor="$background">
            {input
              ? 'Waiting for browser control…'
              : 'Keyboard and paste aren’t available in this session.'}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  );
}
