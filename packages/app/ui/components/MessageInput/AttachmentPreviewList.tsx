import { createDevLogger } from '@tloncorp/shared';
import * as domain from '@tloncorp/shared/domain';
import { filenameFromPath } from '@tloncorp/shared/utils';
import { Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { ImageLoadEventData } from 'expo-image';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ScrollView,
  Spinner,
  View,
  XStack,
  YStack,
  ZStack,
  isWeb,
} from 'tamagui';

import { useAttachmentContext } from '../../contexts/attachment';
import { ContentReferenceLoader } from '../ContentReference';

const logger = createDevLogger('AttachmentPreviewList', false);

export const AttachmentPreviewList = () => {
  const { attachments, attachmentErrorMessage } = useAttachmentContext();
  const visibleAttachments = attachments.filter((a) => a.type !== 'text');
  if (visibleAttachments.length === 0 && !attachmentErrorMessage) {
    return null;
  }
  return (
    <View>
      {visibleAttachments.length > 0 ? (
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
          {visibleAttachments.map((attachment, i) => {
            const hasError =
              (attachment.type === 'image' || attachment.type === 'video') &&
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
      ) : null}
      {attachmentErrorMessage ? (
        <Text
          color="$negativeActionText"
          fontSize="$s"
          paddingHorizontal="$m"
          paddingTop="$xs"
        >
          {attachmentErrorMessage}
        </Text>
      ) : null}
    </View>
  );
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
  const initialAspect = useMemo(() => {
    if (
      attachment.type === 'video' &&
      attachment.width != null &&
      attachment.height != null &&
      attachment.height > 0
    ) {
      return attachment.width / attachment.height;
    }
    return 1;
  }, [attachment]);
  const [aspect, setAspect] = useState(initialAspect);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAspect(initialAspect);
  }, [initialAspect]);

  const handleLoad = useCallback((e: ImageLoadEventData) => {
    setAspect(e.source.width / e.source.height);
    setIsLoading(false);
  }, []);

  const renderPosterImage = useCallback(
    (uri: string) => (
      <Image
        backgroundColor={'$secondaryBackground'}
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        onLoad={handleLoad}
        onLoadStart={() => setIsLoading(true)}
        onError={() => setIsLoading(false)}
        source={{ uri }}
        contentFit="cover"
      />
    ),
    [handleLoad]
  );

  const Container = useCallback(
    ({
      children,
      showSpinner,
    }: PropsWithChildren<{ showSpinner?: boolean }>) => (
      <View
        height={128}
        borderRadius="$m"
        overflow="hidden"
        aspectRatio={aspect}
      >
        {children}
        <RemoveAttachmentButton attachment={attachment} />

        {showSpinner && (
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
    ),
    [aspect, attachment]
  );

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

  switch (attachment.type) {
    case 'link': {
      return <LinkPreview attachment={attachment} />;
    }

    case 'image': {
      return (
        <Container showSpinner={uploading || isLoading}>
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
        </Container>
      );
    }

    case 'video': {
      const posterUri = domain.videoPosterUri(attachment);
      const videoUri = domain.videoFileUri(attachment);
      if (!posterUri && !videoUri) {
        return <Container showSpinner />;
      }
      if (isWeb) {
        const previewUri = posterUri ?? videoUri;
        if (!videoUri) {
          if (!previewUri) {
            return <Container showSpinner />;
          }
          return (
            <Container showSpinner={uploading || isLoading}>
              {renderPosterImage(previewUri)}
            </Container>
          );
        }
        return (
          <Container showSpinner={uploading || isLoading}>
            <video
              src={videoUri}
              poster={posterUri}
              preload="metadata"
              muted
              playsInline
              onLoadStart={() => setIsLoading(true)}
              onLoadedMetadata={(event) => {
                if (
                  event.currentTarget.videoWidth &&
                  event.currentTarget.videoHeight
                ) {
                  setAspect(
                    event.currentTarget.videoWidth /
                      event.currentTarget.videoHeight
                  );
                }
                setIsLoading(false);
              }}
              onError={() => setIsLoading(false)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
                background: 'transparent',
              }}
            />
          </Container>
        );
      }
      if (!posterUri) {
        return (
          <Container showSpinner={uploading}>
            <VideoPosterFallback />
          </Container>
        );
      }
      return (
        <Container showSpinner={uploading || isLoading}>
          {renderPosterImage(posterUri)}
        </Container>
      );
    }

    case 'reference': {
      return (
        <Container showSpinner={uploading}>
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
        </Container>
      );
    }

    case 'text': {
      return <Container showSpinner={uploading} />;
    }

    case 'file': {
      return (
        <Container showSpinner={uploading}>
          <Text
            style={{ padding: 12, flex: 1 }}
            backgroundColor="$secondaryBackground"
          >
            {attachment.name ??
              (attachment.localFile instanceof File
                ? attachment.localFile.name
                : filenameFromPath(attachment.localFile, {
                    decodeURI: true,
                  })) ??
              'Attachment'}
          </Text>
        </Container>
      );
    }

    case 'voicememo': {
      return (
        <Container showSpinner={uploading}>
          <View backgroundColor="$secondaryBackground" flex={1}>
            <Text style={{ padding: 12 }}>Voice Memo</Text>
            {attachment.transcription && (
              <Text
                flex={1}
                style={{ padding: 12, flex: 1 }}
                numberOfLines={3}
                color="$secondaryText"
              >
                &quot;{attachment.transcription}&quot;
              </Text>
            )}
          </View>
        </Container>
      );
    }

    default: {
      // this will raise type error if missing a case
      const _exhaustiveCheck: never = attachment;
      logger.trackError('Unhandled attachment type', {
        attachment,
      });
      throw new Error(
        'Unhandled attachment type: ' + JSON.stringify(_exhaustiveCheck)
      );
    }
  }
}

function VideoPosterFallback() {
  return (
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
