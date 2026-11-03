import { FilePreview, Image, Pressable, Text } from '@tloncorp/ui';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScrollView, Spinner, View, YStack } from 'tamagui';

import { useWebView } from '../../../hooks/useWebview';
import { ScreenHeader } from '../ScreenHeader';
import { BucketFileViewerScriptsBanner } from './BucketFileViewerScriptsBanner';
import {
  BucketFileViewerItem,
  HTML_PREVIEW_NATIVE_SANDBOX,
  bucketFileViewerHeading,
  getBucketPreviewKind,
  htmlPreviewDocument,
  htmlPreviewHasScripts,
  htmlPreviewKey,
  htmlPreviewLinkFromBridge,
  htmlPreviewNavigation,
  htmlPreviewReadable,
  htmlPreviewShell,
  releaseHtmlPreview,
} from './BucketFileViewer.shared';

export function BucketFileViewer({
  error,
  item,
  loading = false,
  onClose,
  onOpenExternally,
  onRetry,
}: {
  error?: string | null;
  item: BucketFileViewerItem;
  loading?: boolean;
  onClose: () => void;
  onOpenExternally?: () => void;
  onRetry?: () => void;
}) {
  const previewKind = getBucketPreviewKind(item);
  const heading = bucketFileViewerHeading(item);
  const webview = useWebView();
  // A page's scripts run only once the reader asks, file by file: a running
  // page can post to the WebView's message bridge as often as it likes, and
  // every message reaches the app's JavaScript thread. Until then only our
  // link script runs (htmlPreviewHeldPolicy).
  const [scriptsRunFor, setScriptsRunFor] = useState<string>();
  // A file the preview cannot read is not rendered: it gets the unsupported
  // notice and its Open button (htmlPreviewReadable). The tree it read is let
  // go once the viewer closes.
  useEffect(() => releaseHtmlPreview, []);
  const html =
    previewKind === 'html' &&
    item.textContent !== undefined &&
    htmlPreviewReadable(item.textContent)
      ? item.textContent
      : undefined;
  const pageHasScripts = useMemo(
    () => html !== undefined && htmlPreviewHasScripts(html),
    [html]
  );
  const fileId = item.uri ?? item.name;
  const runScripts = pageHasScripts && scriptsRunFor === fileId;
  // Offered only over a page on screen: not while it loads, nor over an error.
  const offerScripts =
    pageHasScripts && !runScripts && !loading && !error && Boolean(item.uri);

  return (
    <YStack flex={1} minHeight={0} backgroundColor="$background">
      <ScreenHeader
        backAction={onClose}
        borderBottom
        rightControls={
          item.uri && onOpenExternally ? (
            <ScreenHeader.TextButton onPress={onOpenExternally}>
              Open
            </ScreenHeader.TextButton>
          ) : null
        }
        showSubtitle
        subtitle={heading.subtitle}
        title={heading.title}
      />
      {offerScripts ? (
        <BucketFileViewerScriptsBanner
          onEnable={() => setScriptsRunFor(fileId)}
        />
      ) : null}
      <View flex={1} minHeight={0} backgroundColor="$secondaryBackground">
        {loading ? (
          <LoadingPreview />
        ) : error ? (
          <FailedPreview onRetry={onRetry} />
        ) : !item.uri ? (
          <FailedPreview onRetry={onRetry} />
        ) : previewKind === 'image' ? (
          <Image
            source={{ uri: item.uri }}
            width="100%"
            height="100%"
            contentFit="contain"
            alt={item.name}
          />
        ) : previewKind === 'video' ? (
          <NativeVideoPreview uri={item.uri} />
        ) : previewKind === 'pdf' && Platform.OS === 'ios' && webview ? (
          <WebView webview={webview} source={{ uri: item.uri }} />
        ) : html !== undefined ? (
          <NativeHtmlPreview html={html} runScripts={runScripts} />
        ) : previewKind === 'text' && item.textContent !== undefined ? (
          <ScrollView flex={1}>
            <Text
              color="$primaryText"
              fontFamily="$mono"
              lineHeight={24}
              padding="$2xl"
              selectable
              size="$body"
            >
              {item.textContent}
            </Text>
          </ScrollView>
        ) : (
          <UnsupportedPreview
            item={item}
            isAndroidPdf={previewKind === 'pdf' && Platform.OS === 'android'}
            onOpen={onOpenExternally}
          />
        )}
      </View>
    </YStack>
  );
}

function LoadingPreview() {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$m">
      <Spinner size="large" color="$secondaryText" />
      <Text color="$secondaryText" size="$label/m">
        Loading file…
      </Text>
    </YStack>
  );
}

function FailedPreview({ onRetry }: { onRetry?: () => void }) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$l"
      padding="$2xl"
    >
      <YStack alignItems="center" gap="$xs">
        <Text color="$primaryText" size="$label/l">
          Couldn’t load this file
        </Text>
        <Text color="$tertiaryText" size="$label/m" textAlign="center">
          Check your connection and try again.
        </Text>
      </YStack>
      {onRetry ? (
        <Pressable
          backgroundColor="$primaryText"
          borderRadius="$xl"
          onPress={onRetry}
          paddingHorizontal="$xl"
          paddingVertical="$m"
        >
          <Text color="$background" size="$label/l">
            Try again
          </Text>
        </Pressable>
      ) : null}
    </YStack>
  );
}

function NativeVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.play();
  });

  return (
    <View flex={1} alignItems="center" justifyContent="center" padding="$l">
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={{ aspectRatio: 16 / 9, width: '100%' }}
      />
    </View>
  );
}

/**
 * Renders an HTML file from its text, in a WebView kept apart from the app.
 *
 * The document is a stranger's: anyone who can write to the Bucket wrote it.
 * It sits in a sandboxed frame inside a shell of ours (htmlPreviewShell), so
 * it cannot navigate itself away or raise a dialog. Its scripts run only once
 * the reader asks (`runScripts`); until then the policy runs ours alone
 * (htmlPreviewHeldPolicy). Then they run against its own DOM and nothing
 * else, with HTML_PREVIEW_POLICY keeping them off the network and its forms
 * from submitting. The WebView itself loads nothing but the two inline
 * documents (htmlPreviewNavigation).
 *
 * A link the reader taps still opens, the way a link in chat does. The shell
 * asks the app over the WebView's message bridge, and the app opens the link
 * only when the message carries the token the shell was rendered with
 * (htmlPreviewLinkFromBridge), since every frame, the file's included, can
 * post to that bridge.
 *
 * On iOS the WebView also gets a non-persistent data store with the app's
 * cookies kept out, so nothing the document loads carries the reader's ship
 * session. On Android every WebView in the process shares one cookie jar --
 * the one React Native's own networking keeps the session in -- which is why
 * the policy matters there; `incognito` on Android clears that jar, which
 * would sign the reader out, so it is iOS-only.
 */
function NativeHtmlPreview({
  html,
  runScripts,
}: {
  html: string;
  runScripts: boolean;
}) {
  const secrets = useMemo(
    () => ({
      key: htmlPreviewKey(),
      nonce: htmlPreviewKey(),
      token: htmlPreviewKey(),
    }),
    []
  );
  const lastOpened = useRef(0);
  const source = useMemo(() => {
    const nonce = runScripts ? undefined : secrets.nonce;
    return {
      html: htmlPreviewShell({
        document: htmlPreviewDocument(
          html,
          secrets.key,
          nonce === undefined ? { scripts: 'all' } : { scripts: 'ours', nonce }
        ),
        key: secrets.key,
        nonce,
        opener: { kind: 'app', token: secrets.token },
        sandbox: HTML_PREVIEW_NATIVE_SANDBOX,
      }),
    };
  }, [html, runScripts, secrets]);
  return (
    <WebView
      allowFileAccess={false}
      allowFileAccessFromFileURLs={false}
      allowUniversalAccessFromFileURLs={false}
      allowsLinkPreview={false}
      incognito={Platform.OS === 'ios'}
      javaScriptCanOpenWindowsAutomatically={false}
      javaScriptEnabled
      onMessage={(event) => {
        const href = htmlPreviewLinkFromBridge(
          event.nativeEvent.data,
          secrets.token
        );
        const now = Date.now();
        if (!href || now - lastOpened.current < 1000) return;
        lastOpened.current = now;
        Linking.openURL(href).catch(() => {});
      }}
      onShouldStartLoadWithRequest={(request) =>
        htmlPreviewNavigation(request) === 'load'
      }
      // Every navigation reaches the handler above. With the default list the
      // library itself opens any URL outside it in another app, before asking.
      originWhitelist={['*']}
      setSupportMultipleWindows={false}
      sharedCookiesEnabled={false}
      source={source}
      style={{ backgroundColor: 'white', flex: 1 }}
      thirdPartyCookiesEnabled={false}
    />
  );
}

function UnsupportedPreview({
  isAndroidPdf,
  item,
  onOpen,
}: {
  isAndroidPdf: boolean;
  item: BucketFileViewerItem;
  onOpen?: () => void;
}) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$l"
      padding="$2xl"
    >
      <FilePreview
        fileExtensionLabel={
          FilePreview.fileExtensionFrom({
            filename: item.name,
            mimeType: item.mimeType,
          }) ?? undefined
        }
        size="m"
      />
      <YStack alignItems="center" gap="$xs">
        <Text color="$primaryText" size="$label/l">
          {isAndroidPdf ? 'Open PDF to view' : 'Preview unavailable'}
        </Text>
        <Text color="$tertiaryText" size="$label/m" textAlign="center">
          {isAndroidPdf
            ? 'PDFs open in your device viewer.'
            : 'Open this file in another app to view it.'}
        </Text>
      </YStack>
      {onOpen ? (
        <Pressable
          backgroundColor="$primaryText"
          borderRadius="$xl"
          onPress={onOpen}
          paddingHorizontal="$xl"
          paddingVertical="$m"
        >
          <Text color="$background" size="$label/l">
            Open file
          </Text>
        </Pressable>
      ) : null}
    </YStack>
  );
}
