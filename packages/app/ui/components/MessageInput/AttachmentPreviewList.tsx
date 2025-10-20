import * as domain from '@tloncorp/shared/domain';
import { Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Spinner, View, XStack, YStack, ZStack } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { ContentReferenceLoader } from '../ContentReference';

export const AttachmentPreviewList = () => {
  const { attachments } = useAttachmentContext();
  return attachments.length ? (
    <ScrollView
      contentContainerStyle={{
        padding: '$m',
        paddingBottom: 0,
        gap: '$2xs',
        justifyContent: 'flex-start',
        minWidth: '100%',
      }}
      overScrollMode="always"
      horizontal={true}
    >
      {attachments
        .filter((a) => a.type !== 'text')
        .map((attachment, i) => {
          const hasError =
            attachment.type === 'image' &&
            attachment.uploadState?.status === 'error';
          return (
            <AttachmentPreview
              key={i}
              attachment={attachment}
              uploading={false}
              error={hasError}
            />
          );
        })}
    </ScrollView>
  ) : null;
};

export function AttachmentPreview({
  attachment,
  uploading,
  error,
}: {
  attachment: domain.Attachment;
  uploading?: boolean;
  error?: boolean;
}) {
  const [aspect, setAspect] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const handleLoad = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
    setIsLoading(false);
  }, []);

  if (error) {
    return (
      <View
        height={128}
        borderRadius="$m"
        overflow="hidden"
        aspectRatio={aspect}
        backgroundColor="$secondaryBackground"
        justifyContent="center"
      >
        <Text
          color="$negativeActionText"
          fontSize="$s"
          textAlign="center"
          paddingVertical="$s"
          paddingHorizontal="$m"
          fontWeight="$xl"
        >
          Attachment failed to load.
        </Text>
        <RemoveAttachmentButton attachment={attachment} />
      </View>
    );
  }

  if (attachment.type === 'link') {
    return <LinkPreview attachment={attachment} />;
  }

  if (attachment.type === 'file') {
    return <FilePreview attachment={attachment} uploading={uploading} />;
  }

  return (
    <View height={128} borderRadius="$m" overflow="hidden" aspectRatio={aspect}>
      {attachment.type === 'image' ? (
        <Image
          backgroundColor={'$secondaryBackground'}
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          onLoad={handleLoad}
          onLoadStart={() => setIsLoading(true)}
          source={{
            uri: attachment.file.uri,
          }}
        />
      ) : attachment.type === 'reference' ? (
        <ContentReferenceLoader
          position="absolute"
          contentSize="$s"
          top={0}
          left={0}
          width={'100%'}
          height={'100%'}
          reference={attachment.reference}
          actionIcon={null}
        />
      ) : null}

      <RemoveAttachmentButton attachment={attachment} />

      {(uploading || (attachment.type === 'image' && isLoading)) && (
        <View
          position="absolute"
          top={0}
          justifyContent="center"
          width="100%"
          height="100%"
          alignItems="center"
          backgroundColor="$translucentBlack"
        >
          <Spinner size="large" color="$primaryText" />
        </View>
      )}
    </View>
  );
}

const RemoveAttachmentButton = ({
  attachment,
}: {
  attachment: domain.Attachment;
}) => {
  const { removeAttachment } = useAttachmentContext();
  const handlePress = useCallback(() => {
    removeAttachment(attachment);
  }, [removeAttachment, attachment]);
  return (
    <Pressable
      width="$xl"
      height="$xl"
      borderColor="$border"
      backgroundColor={'$background'}
      alignItems="center"
      justifyContent="center"
      borderRadius="$xs"
      position="absolute"
      top="$s"
      right="$s"
      onPress={handlePress}
    >
      <Icon size="$s" type="Close" />
    </Pressable>
  );
};

const LinkPreview = ({ attachment }: { attachment: domain.LinkAttachment }) => {
  const { url, title, previewImageUrl } = attachment;

  const domain = useMemo(() => {
    const parsed = new URL(url);
    return parsed.hostname;
  }, [url]);

  return (
    <View
      height={200}
      width={240}
      borderRadius="$m"
      overflow="hidden"
      backgroundColor="$secondaryBackground"
    >
      {/* Container for properly positioning elements */}
      <ZStack flex={1}>
        <View flex={1}>
          {previewImageUrl ? (
            <Image
              backgroundColor={'$secondaryBackground'}
              source={{ uri: previewImageUrl }}
              height={200}
              width={240}
              contentFit="cover"
            />
          ) : null}
        </View>
        <YStack flex={1} justifyContent="flex-end">
          <YStack
            padding="$xl"
            backgroundColor="$secondaryBackground"
            opacity={0.9}
            gap="$m"
          >
            <Text size="$label/m" numberOfLines={1}>
              {title}
            </Text>
            <XStack alignItems="center" gap="$s">
              <Icon type="Link" color="$secondaryText" customSize={[14, 14]} />
              <Text size="$label/m" color="$secondaryText">
                {domain}
              </Text>
            </XStack>
          </YStack>
        </YStack>

        <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000 }}>
          <RemoveAttachmentButton attachment={attachment} />
        </View>
      </ZStack>
    </View>
  );
};

const FilePreview = ({
  attachment,
  uploading,
}: {
  attachment: domain.FileAttachment;
  uploading?: boolean;
}) => {
  const fileName = attachment.file.fileName || 'Unknown file';

  return (
    <View
      height={128}
      width={200}
      borderRadius="$m"
      overflow="hidden"
      backgroundColor="$secondaryBackground"
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        padding="$m"
        gap="$m"
      >
        <Icon type="Document" size="$2xl" color="$primaryText" />
        <Text
          size="$label/m"
          numberOfLines={2}
          textAlign="center"
          color="$primaryText"
        >
          {fileName}
        </Text>
      </YStack>

      <RemoveAttachmentButton attachment={attachment} />

      {uploading && (
        <View
          position="absolute"
          top={0}
          justifyContent="center"
          width="100%"
          height="100%"
          alignItems="center"
          backgroundColor="$translucentBlack"
        >
          <Spinner size="large" color="$primaryText" />
        </View>
      )}
    </View>
  );
};
