import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import { useCallback, useState } from 'react';
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
