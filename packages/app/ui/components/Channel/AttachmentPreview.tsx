import {
  FileAttachment,
  ImageAttachment,
  VideoAttachment,
  videoPosterUri,
} from '@tloncorp/shared';
import { useMemo } from 'react';
import { ImageBackground } from 'react-native';
import { Spinner, View } from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { FileUploadLockup } from '../FileUploadPreview';

function AttachmentPreview() {
  const { attachments } = useAttachmentContext();

  const focusedAttachment = useMemo(() => {
    if (attachments.length === 0) return null;
    if (attachments.length > 1) {
      console.warn(
        'Multiple attachments found, but we only support displaying one. Displaying the first attachment...'
      );
    }
    return attachments[0];
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
  return (
    <ImageBackground
      source={{ uri: imageAttachment?.file.uri }}
      style={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: imageAttachment?.uploadState?.status === 'uploading' ? 0.5 : 1,
      }}
      resizeMode="contain"
    >
      {imageAttachment?.uploadState?.status === 'uploading' && (
        <View
          top={0}
          justifyContent="center"
          padding="$xl"
          alignItems="center"
          backgroundColor="$translucentBlack"
          borderRadius="$m"
        >
          <Spinner size="large" color="$primaryText" />
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
        {videoAttachment?.uploadState?.status === 'uploading' ? (
          <View
            top={0}
            justifyContent="center"
            padding="$xl"
            alignItems="center"
            backgroundColor="$translucentBlack"
            borderRadius="$m"
          >
            <Spinner size="large" color="$primaryText" />
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
        opacity: videoAttachment?.uploadState?.status === 'uploading' ? 0.5 : 1,
      }}
      resizeMode="contain"
    >
      {videoAttachment?.uploadState?.status === 'uploading' && (
        <View
          top={0}
          justifyContent="center"
          padding="$xl"
          alignItems="center"
          backgroundColor="$translucentBlack"
          borderRadius="$m"
        >
          <Spinner size="large" color="$primaryText" />
        </View>
      )}
    </ImageBackground>
  );
}

export default AttachmentPreview;
