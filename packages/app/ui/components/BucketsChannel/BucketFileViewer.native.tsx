import { FilePreview, Pressable, Text } from '@tloncorp/ui';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScrollView, Spinner, View, YStack } from 'tamagui';

import { useWebView } from '../../../hooks/useWebview';
import { ScreenHeader } from '../ScreenHeader';
import { BucketFilePager } from './BucketFilePager';
import { BucketPreviewControls } from './BucketPreviewControls';
import { BucketPreviewOpenButton } from './BucketPreviewOpenButton';
import { BucketPreviewContent } from './BucketPreviewContent';
import { BucketPreviewImage } from './BucketPreviewImage';
import { BucketAudioPreview } from './BucketAudioPreview';
import {
  BucketFileViewerItem,
  BucketFileNavigation,
  getBucketPreviewKind,
} from './BucketFileViewer.shared';

export function BucketFileViewer({
  error,
  item,
  loading = false,
  navigation,
  onClose,
  onOpenExternally,
  onRetry,
}: {
  error?: string | null;
  item: BucketFileViewerItem;
  loading?: boolean;
  navigation?: BucketFileNavigation;
  onClose: () => void;
  onOpenExternally?: () => void;
  onRetry?: () => void;
}) {
  const previewKind = getBucketPreviewKind(item);
  const webview = useWebView();

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
        subtitle={item.sizeLabel ?? 'File'}
        title={item.name}
      />
      <BucketFilePager navigation={navigation}>
        <BucketPreviewContent
          key={item.id ?? item.uri ?? item.name}
          loading={loading}
          animate={previewKind !== 'image'}
        >
          {loading ? (
            <LoadingPreview />
          ) : error ? (
            <FailedPreview onRetry={onRetry} />
          ) : !item.uri ? (
            <FailedPreview onRetry={onRetry} />
          ) : previewKind === 'image' ? (
            <BucketPreviewImage uri={item.uri} name={item.name} />
          ) : previewKind === 'audio' ? (
            <BucketAudioPreview item={{ ...item, uri: item.uri }} />
          ) : previewKind === 'video' ? (
            <NativeVideoPreview uri={item.uri} />
          ) : previewKind === 'pdf' && Platform.OS === 'ios' && webview ? (
            <WebView webview={webview} source={{ uri: item.uri }} />
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
        <Text color="$primaryText" size="$label/l" textAlign="center">
          {item.name}
        </Text>
        <Text color="$secondaryText" size="$label/m">
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
