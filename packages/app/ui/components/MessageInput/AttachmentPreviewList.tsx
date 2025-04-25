import * as domain from '@tloncorp/shared/domain';
import { Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Spinner, View } from 'tamagui';

import { Attachment, useAttachmentContext } from '../../contexts/attachment';
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
  attachment: Attachment;
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

  return (
    <View height={128} borderRadius="$m" overflow="hidden" aspectRatio={aspect}>
      {attachment.type === 'image' ? (
        <Image
          backgroundColor={'$secondaryBackground'}
          position="absolute"
          top={0}
          right={0}
          left={0}
          bottom={0}
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

const RemoveAttachmentButton = ({ attachment }: { attachment: Attachment }) => {
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
  const { icon, siteName, description, previewImageUrl } = attachment;
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    console.log(`bl: image loaded update`, { imageLoaded, previewImageUrl });
  }, [imageLoaded, previewImageUrl]);

  return (
    <View
      height={128}
      width={240}
      borderRadius="$m"
      overflow="hidden"
      backgroundColor="$secondaryBackground"
    >
      {/* Container for properly positioning elements */}
      <View style={{ width: '100%', height: '100%' }}>
        {/* Image section - top half only */}
        {previewImageUrl ? (
          <View style={{ height: '50%', width: '100%', overflow: 'hidden' }}>
            <Image
              source={previewImageUrl}
              style={{
                width: '100%',
                height: '100%',
                resizeMode: 'cover',
              }}
              onLoad={() => setImageLoaded(true)}
              onError={(e: Error) => console.error('Image load error:', e)}
            />
          </View>
        ) : null}

        {/* Text section - always on bottom half */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            backgroundColor: '$secondaryBackground',
            padding: 8, // Equivalent to $s
            height: '50%',
            justifyContent: 'space-between',
          }}
        >
          <View flexDirection="row" alignItems="center" marginBottom="$xs">
            {icon ? (
              <Image
                source={{ uri: icon }}
                width={16}
                height={16}
                marginRight="$xs"
                onError={(err: Error) =>
                  console.error('bl: Icon load error:', err)
                }
              />
            ) : (
              <Icon type="Link" size="$s" marginRight="$xs" />
            )}
            <Text fontSize="$xs" color="$secondaryText" numberOfLines={1}>
              {siteName || 'Link'}
            </Text>
          </View>

          {description ? (
            <Text fontSize="$s" color="$primaryText" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Remove button should be on top of everything */}
      <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 1000 }}>
        <RemoveAttachmentButton attachment={attachment} />
      </View>
    </View>
  );
};
