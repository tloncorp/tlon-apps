import { ImageLoadEventData } from 'expo-image';
import { useCallback, useState } from 'react';

import { Attachment, useAttachmentContext } from '../../contexts/attachment';
import { Image, ScrollView, Spinner, View } from '../../core';
import { ContentReferenceLoader } from '../ContentReference';
import { Icon } from '../Icon';

export const AttachmentPreviewList = () => {
  const { attachments } = useAttachmentContext();
  return attachments.length ? (
    <ScrollView
      contentContainerStyle={{ padding: '$m', paddingBottom: 0, gap: '$2xs' }}
      horizontal={true}
      showsHorizontalScrollIndicator={false}
    >
      {attachments.map((attachment, i) => {
        return (
          <AttachmentPreview
            key={i}
            attachment={attachment}
            uploading={false}
          />
        );
      })}
    </ScrollView>
  ) : null;
};

export function AttachmentPreview({
  attachment,
  uploading,
}: {
  attachment: Attachment;
  uploading?: boolean;
}) {
  const [aspect, setAspect] = useState(1);
  const handleLoad = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
  }, []);

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
          source={{
            uri: attachment.file.uri,
          }}
        />
      ) : (
        <ContentReferenceLoader
          position="absolute"
          top={0}
          left={0}
          width={'100%'}
          height={'100%'}
          reference={attachment.reference}
          actionIcon={null}
        />
      )}

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
}

const RemoveAttachmentButton = ({ attachment }: { attachment: Attachment }) => {
  const { removeAttachment } = useAttachmentContext();
  const handlePress = useCallback(() => {
    removeAttachment(attachment);
  }, [removeAttachment, attachment]);
  return (
    <View
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
    </View>
  );
};
