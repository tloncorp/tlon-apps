import { FilePreview, Image, Pressable, Text } from '@tloncorp/ui';
import { useMemo, useState } from 'react';
import { ScrollView, Spinner, View, YStack } from 'tamagui';

import { useIsElectron } from '../../../hooks/useIsElectron';
import { ScreenHeader } from '../ScreenHeader';
import {
  BucketFileViewerItem,
  type HtmlPreviewScripts,
  bucketFileViewerHeading,
  getBucketPreviewKind,
  htmlPreviewDocument,
  htmlPreviewHasScripts,
  htmlPreviewKey,
  htmlPreviewSandboxes,
  htmlPreviewShell,
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
  const isElectron = Boolean(useIsElectron());
  const previewKey = useMemo(() => htmlPreviewKey(), []);
  const previewNonce = useMemo(() => htmlPreviewKey(), []);
  // A page's scripts run on web only once the reader asks, file by file: in a
  // browser they share the app's thread, so a page whose script never
  // returns would freeze the whole tab the moment it was opened. Until then
  // only our link script runs (htmlPreviewHeldPolicy). Under Electron no
  // script runs (htmlPreviewSandboxes).
  const [scriptsRunFor, setScriptsRunFor] = useState<string>();
  const pageHasScripts = useMemo(
    () =>
      previewKind === 'html' &&
      item.textContent !== undefined &&
      htmlPreviewHasScripts(item.textContent),
    [previewKind, item.textContent]
  );
  const fileId = item.uri ?? item.name;
  const runScripts = !isElectron && pageHasScripts && scriptsRunFor === fileId;
  const offerScripts = !isElectron && pageHasScripts && !runScripts;
  const scripts: HtmlPreviewScripts = isElectron
    ? 'none'
    : runScripts
      ? 'all'
      : 'ours';
  const sandboxes = htmlPreviewSandboxes({ scripts });

  return (
    <YStack flex={1} minHeight={0} backgroundColor="$background">
      <ScreenHeader
        backAction={onClose}
        borderBottom
        rightControls={
          offerScripts || (item.uri && onOpenExternally) ? (
            <>
              {offerScripts ? (
                <ScreenHeader.TextButton
                  onPress={() => setScriptsRunFor(fileId)}
                  testID="BucketFileViewerRunScripts"
                >
                  Run scripts
                </ScreenHeader.TextButton>
              ) : null}
              {item.uri && onOpenExternally ? (
                <ScreenHeader.TextButton onPress={onOpenExternally}>
                  Open
                </ScreenHeader.TextButton>
              ) : null}
            </>
          ) : null
        }
        showSubtitle
        subtitle={heading.subtitle}
        title={heading.title}
        useHorizontalTitleLayout
      />
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
          <View
            flex={1}
            alignItems="center"
            justifyContent="center"
            padding="$l"
          >
            <video
              src={item.uri}
              controls
              preload="metadata"
              style={{ display: 'block', maxHeight: '100%', maxWidth: '100%' }}
            />
          </View>
        ) : previewKind === 'pdf' ? (
          <iframe
            src={item.uri}
            title={item.name}
            style={{ border: 0, height: '100%', width: '100%' }}
          />
        ) : previewKind === 'html' && item.textContent !== undefined ? (
          <iframe
            referrerPolicy="no-referrer"
            sandbox={sandboxes.shell}
            srcDoc={htmlPreviewShell({
              document: htmlPreviewDocument(
                item.textContent,
                previewKey,
                scripts === 'ours'
                  ? { scripts, nonce: previewNonce }
                  : { scripts }
              ),
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
        <Text color="$primaryText" size="$label/l">
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
