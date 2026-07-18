import { FilePreview, Image, Pressable, Text } from '@tloncorp/ui';
import { ScrollView, View, YStack } from 'tamagui';

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
        useHorizontalTitleLayout
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
          <UnsupportedPreview item={item} onOpen={onOpenExternally} />
        )}
      </View>
    </YStack>
  );
}

function UnsupportedPreview({
  item,
  onOpen,
}: {
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
          Preview unavailable
        </Text>
        <Text color="$tertiaryText" size="$label/m" textAlign="center">
          Open this file in another app to view it.
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
