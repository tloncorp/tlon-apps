import { FilePreview, Pressable, Text } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Spinner, View, YStack } from 'tamagui';

import { useIsElectron } from '../../../hooks/useIsElectron';
import { ScreenHeader } from '../ScreenHeader';
import { BucketAudioPreview } from './BucketAudioPreview';
import { BucketFilePager } from './BucketFilePager';
import { BucketPreviewControls } from './BucketPreviewControls';
import { BucketPreviewOpenButton } from './BucketPreviewOpenButton';
import { BucketPreviewContent } from './BucketPreviewContent';
import { BucketPreviewImage } from './BucketPreviewImage';
import { BucketFileViewerScriptsBanner } from './BucketFileViewerScriptsBanner';
import {
  BucketFileViewerItem,
  BucketFileNavigation,
  type HtmlPreviewScripts,
  bucketFileViewerHeading,
  getBucketPreviewKind,
  htmlPreviewDocument,
  htmlPreviewHasScripts,
  htmlPreviewKey,
  htmlPreviewReadable,
  htmlPreviewSandboxes,
  htmlPreviewShell,
  releaseHtmlPreview,
} from './BucketFileViewer.shared';

export function BucketFileViewer({
  error,
  item,
  loading = false,
  navigation,
  onClose,
  onImageLoad,
  onPreviewError,
  onOpenExternally,
  onRetry,
}: {
  error?: string | null;
  item: BucketFileViewerItem;
  loading?: boolean;
  navigation?: BucketFileNavigation;
  onClose: () => void;
  onImageLoad?: () => void;
  onPreviewError?: () => void;
  onOpenExternally?: () => void;
  onRetry?: () => void;
}) {
  const previewKind = getBucketPreviewKind(item);
  const isElectron = Boolean(useIsElectron());
  // Under Electron the frame runs no scripts, so the page's title is read as
  // such a frame reads it.
  const heading = bucketFileViewerHeading(item, { scripting: !isElectron });
  const previewKey = useMemo(() => htmlPreviewKey(), []);
  const previewNonce = useMemo(() => htmlPreviewKey(), []);
  // A page's scripts run on web only once the reader asks, file by file: in a
  // browser they share the app's thread, so a page whose script never
  // returns would freeze the whole tab the moment it was opened. Until then
  // only our link script runs (htmlPreviewHeldPolicy). Under Electron no
  // script runs (htmlPreviewSandboxes).
  const [scriptsRunFor, setScriptsRunFor] = useState<string>();
  // A file the preview cannot read is not rendered: it gets the unsupported
  // notice and its Open button (htmlPreviewReadable). The tree it read is let
  // go once the viewer closes.
  useEffect(() => releaseHtmlPreview, []);
  const html =
    previewKind === 'html' &&
    item.textContent !== undefined &&
    htmlPreviewReadable(item.textContent, { scripting: !isElectron })
      ? item.textContent
      : undefined;
  const pageHasScripts = useMemo(
    () => !isElectron && html !== undefined && htmlPreviewHasScripts(html),
    [isElectron, html]
  );
  const fileId = item.uri ?? item.name;
  const runScripts = !isElectron && pageHasScripts && scriptsRunFor === fileId;
  // Offered only over a page on screen: not while it loads, nor over an error.
  const offerScripts =
    !isElectron &&
    pageHasScripts &&
    !runScripts &&
    !loading &&
    !error &&
    Boolean(item.uri);
  const scripts: HtmlPreviewScripts = isElectron
    ? 'none'
    : runScripts
      ? 'all'
      : 'ours';
  const sandboxes = htmlPreviewSandboxes({ scripts });
  const htmlDocument = useMemo(
    () =>
      html === undefined
        ? undefined
        : htmlPreviewDocument(
            html,
            previewKey,
            scripts === 'ours' ? { scripts, nonce: previewNonce } : { scripts }
          ),
    [html, previewKey, previewNonce, scripts]
  );

  return (
    <YStack flex={1} minHeight={0} backgroundColor="$background">
      <ScreenHeader
        animateTitleChanges
        backAction={onClose}
        borderBottom
        rightControls={
          <BucketPreviewOpenButton
            onPress={item.uri ? onOpenExternally : undefined}
          />
        }
        showSubtitle
        subtitle={heading.subtitle}
        title={heading.title}
        useHorizontalTitleLayout
      />
      {offerScripts ? (
        <BucketFileViewerScriptsBanner
          onEnable={() => setScriptsRunFor(fileId)}
        />
      ) : null}
      <BucketFilePager
        navigation={navigation}
        retainActivePage={
          !loading &&
          !error &&
          (previewKind === 'image' ||
            previewKind === 'pdf' ||
            previewKind === 'text')
        }
      >
        <BucketPreviewContent
          key={item.id ?? item.uri ?? item.name}
          loading={loading}
          animate={!item.cached && previewKind !== 'image'}
        >
          {loading ? (
            <LoadingPreview />
          ) : error ? (
            <FailedPreview onRetry={onRetry} />
          ) : !item.uri ? (
            <FailedPreview onRetry={onRetry} />
          ) : previewKind === 'image' ? (
            <BucketPreviewImage
              uri={item.uri}
              name={item.name}
              animate={!item.imageLoaded}
              onLoad={onImageLoad}
              onError={onPreviewError}
              onRetry={onRetry}
            />
          ) : previewKind === 'audio' ? (
            <BucketAudioPreview
              key={item.uri}
              item={{ ...item, uri: item.uri }}
              onError={onPreviewError}
              onRetry={onRetry}
            />
          ) : previewKind === 'video' ? (
            <WebVideoPreview
              key={item.uri}
              uri={item.uri}
              onError={onPreviewError}
              onRetry={onRetry}
            />
          ) : previewKind === 'pdf' ? (
            <YStack flex={1} minHeight={0}>
              <iframe
                src={item.uri}
                title={item.name}
                style={{ border: 0, flex: 1, minHeight: 0, width: '100%' }}
              />
              {/* Cross-origin iframe failures do not reliably emit an error.
                  Keep recovery available even when the embed reports a load. */}
              {onRetry ? (
                <Pressable
                  accessibilityLabel="Reload preview"
                  aria-label="Reload preview"
                  role="button"
                  alignSelf="flex-end"
                  onPress={onRetry}
                  padding="$m"
                >
                  <Text color="$secondaryText" size="$label/m">
                    Reload preview
                  </Text>
                </Pressable>
              ) : null}
            </YStack>
          ) : htmlDocument !== undefined ? (
            <iframe
              referrerPolicy="no-referrer"
              sandbox={sandboxes.shell}
              srcDoc={htmlPreviewShell({
                document: htmlDocument,
                key: previewKey,
                nonce: scripts === 'ours' ? previewNonce : undefined,
                opener: { kind: 'window' },
                sandbox: sandboxes.document,
              })}
              style={{
                backgroundColor: 'white',
                border: 0,
                height: '100%',
                width: '100%',
              }}
              title={item.name}
            />
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
            <UnsupportedPreview item={item} onOpen={onOpenExternally} />
          )}
        </BucketPreviewContent>
      </BucketFilePager>
      <BucketPreviewControls navigation={navigation} />
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
          accessibilityLabel="Retry file"
          aria-label="Retry file"
          role="button"
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

function WebVideoPreview({
  uri,
  onError,
  onRetry,
}: {
  uri: string;
  onError?: () => void;
  onRetry?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <FailedPreview onRetry={onRetry} />
  ) : (
    <View flex={1} alignItems="center" justifyContent="center" padding="$l">
      <video
        src={uri}
        controls
        preload="metadata"
        onError={() => {
          setFailed(true);
          onError?.();
        }}
        style={{ display: 'block', maxHeight: '100%', maxWidth: '100%' }}
      />
    </View>
  );
}

function UnsupportedPreview({
  item,
  onOpen,
}: {
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
        <Text color="$primaryText" size="$label/l" textAlign="center">
          {item.name}
        </Text>
        <Text color="$secondaryText" size="$label/m">
          Preview unavailable
        </Text>
        <Text color="$tertiaryText" size="$label/m" textAlign="center">
          Open this file in another app to view it.
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
