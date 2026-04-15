import {
  Attachment,
  FileAttachment,
  ImageAttachment,
  PLACEHOLDER_ASSET_URI,
  VideoAttachment,
  videoPosterUri,
} from '@tloncorp/shared';
import { Icon } from '@tloncorp/ui';
import { useMemo } from 'react';
import { ImageBackground } from 'react-native';
import { Spinner, View } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { FileUploadLockup } from '../FileUploadPreview';

function isPlaceholderImageAttachment(attachment: Attachment) {
  return (
    attachment.type === 'image' && attachment.file.uri === PLACEHOLDER_ASSET_URI
  );
}

function AttachmentPreview() {
  const { attachments } = useAttachmentContext();

  const focusedAttachment = useMemo(() => {
    if (attachments.length === 0) return null;
    if (attachments.length > 1) {
      console.warn(
        'Multiple attachments found, but we only support displaying one. Displaying the first attachment...'
      );
    }
    const nonPlaceholderAttachment = attachments.find(
      (attachment) => !isPlaceholderImageAttachment(attachment)
    );
    return nonPlaceholderAttachment ?? attachments[0];
  }, [attachments]);

  switch (focusedAttachment?.type) {
    case 'image':
      return <ContentImage imageAttachment={focusedAttachment} />;
    case 'video':
      return <ContentVideo videoAttachment={focusedAttachment} />;

    case 'file':
      return <ContentFile fileAttachment={focusedAttachment} />;

    case 'link':
    case 'reference':
    case 'text':
    case undefined:
      return null;
  }
}

function ContentFile({ fileAttachment }: { fileAttachment: FileAttachment }) {
  return (
    <View flex={1} alignItems="center" justifyContent="center">
      <FileUploadLockup file={fileAttachment} />
    </View>
  );
}

function ContentImage({
  imageAttachment,
}: {
  imageAttachment: ImageAttachment;
}) {
  if (imageAttachment.file.uri === PLACEHOLDER_ASSET_URI) {
    return (
      <View
        width="100%"
        height="100%"
        alignItems="center"
        justifyContent="center"
        backgroundColor="$secondaryBackground"
      >
        <Spinner size="small" color="$primaryText" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: imageAttachment?.file.uri }}
      style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      resizeMode="contain"
    >
      {imageAttachment?.uploadState?.status === 'uploading' && (
        <View
          top={0}
          justifyContent="center"
          padding="$s"
          alignItems="center"
          backgroundColor="$secondaryBackground"
          borderRadius="$m"
        >
          <Spinner size="small" color="$primaryText" />
        </View>
      )}
    </ImageBackground>
  );
}

function ContentVideo({
  videoAttachment,
}: {
  videoAttachment: VideoAttachment;
}) {
  const uri = videoPosterUri(videoAttachment);
  if (!uri) {
    return (
      <View flex={1} alignItems="center" justifyContent="center">
        <View
          backgroundColor="$secondaryBackground"
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          justifyContent="center"
          alignItems="center"
        >
          <Icon type="Play" color="$tertiaryText" size="$xl" />
        </View>
        {videoAttachment.uploadState?.status === 'uploading' ? (
          <View
            top={0}
            justifyContent="center"
            padding="$s"
            alignItems="center"
            backgroundColor="$secondaryBackground"
            borderRadius="$m"
          >
            <Spinner size="small" color="$primaryText" />
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <ImageBackground
      source={{ uri }}
      style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      resizeMode="contain"
    >
      {videoAttachment?.uploadState?.status === 'uploading' && (
        <View
          top={0}
          justifyContent="center"
          padding="$s"
          alignItems="center"
          backgroundColor="$secondaryBackground"
          borderRadius="$m"
        >
          <Spinner size="small" color="$primaryText" />
        </View>
      )}
    </ImageBackground>
  );
}

export default AttachmentPreview;
