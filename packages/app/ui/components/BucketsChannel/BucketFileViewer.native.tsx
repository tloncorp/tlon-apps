import { FilePreview, Image, Pressable, Text } from '@tloncorp/ui';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { ScrollView, View, YStack } from 'tamagui';

import { useWebView } from '../../../hooks/useWebview';
import { ScreenHeader } from '../ScreenHeader';
import {
  BucketFileViewerItem,
  getBucketPreviewKind,
} from './BucketFileViewer.shared';

export function BucketFileViewer({
  item,
  onClose,
  onOpenExternally,
}: {
  item: BucketFileViewerItem;
  onClose: () => void;
  onOpenExternally: () => void;
}) {
  const previewKind = getBucketPreviewKind(item);
  const webview = useWebView();

  return (
    <YStack flex={1} minHeight={0} backgroundColor="$background">
      <ScreenHeader
        backAction={onClose}
        borderBottom
        rightControls={
          <ScreenHeader.TextButton onPress={onOpenExternally}>
            Open
          </ScreenHeader.TextButton>
        }
        showSubtitle
        subtitle={item.sizeLabel ?? 'File'}
        title={item.name}
      />
      <View flex={1} minHeight={0} backgroundColor="$secondaryBackground">
        {previewKind === 'image' ? (
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
        ) : previewKind === 'text' && item.textContent ? (
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
  onOpen: () => void;
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
    </YStack>
  );
}
