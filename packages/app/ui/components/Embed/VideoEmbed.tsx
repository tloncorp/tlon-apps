import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  createDevLogger,
  makePrettyDurationFromSeconds,
} from '@tloncorp/shared';
import { GestureTrigger, Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { ComponentProps, useCallback } from 'react';
import { View, styled } from 'tamagui';

import { RootStackParamList } from '../../../navigation/types';
import { getVideoViewerId } from '../../../utils/mediaViewer';

type VideoEmbedProps = ComponentProps<typeof View> & {
  video: {
    width: number;
    height: number;
    src: string;
    alt?: string;
    duration?: number;
    posterUri?: string;
  };
  contentFit?: 'contain' | 'cover';
};
const logger = createDevLogger('VideoEmbed', false);

const OverlayFrame = styled(View, {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
});

const OverlayPlayBadge = styled(View, {
  backgroundColor: '$mediaScrim',
  borderRadius: 100,
  alignItems: 'center',
  justifyContent: 'center',
  width: '$4xl',
  height: '$4xl',
});

const OverlayDurationBadge = styled(View, {
  position: 'absolute',
  right: 8,
  bottom: 8,
  backgroundColor: '$mediaScrim',
  borderRadius: '$s',
  paddingHorizontal: '$s',
  paddingVertical: '$2xs',
  pointerEvents: 'none',
});

function VideoOverlay({ durationLabel }: { durationLabel?: string }) {
  return (
    <>
      <OverlayFrame>
        <OverlayPlayBadge>
          <Icon type="Play" color="$white" customSize={['$2xl', '$2xl']} />
        </OverlayPlayBadge>
      </OverlayFrame>
      {durationLabel ? (
        <OverlayDurationBadge>
          <Text color="$white" fontSize="$s" fontWeight="$xl">
            {durationLabel}
          </Text>
        </OverlayDurationBadge>
      ) : null}
    </>
  );
}

function resolveConstrainedVideoSize({
  maxWidth,
  maxHeight,
  aspectRatio,
}: {
  maxWidth: ComponentProps<typeof View>['maxWidth'];
  maxHeight: ComponentProps<typeof View>['maxHeight'];
  aspectRatio: number;
}) {
  const numericMaxWidth = typeof maxWidth === 'number' ? maxWidth : undefined;
  const numericMaxHeight =
    typeof maxHeight === 'number' ? maxHeight : undefined;

  if (numericMaxWidth == null || numericMaxHeight == null) {
    return null;
  }

  const width =
    aspectRatio > 0
      ? Math.min(numericMaxWidth, numericMaxHeight * aspectRatio)
      : numericMaxWidth;

  return {
    width,
    height: aspectRatio > 0 ? width / aspectRatio : undefined,
  };
}

export default function VideoEmbed({
  video,
  contentFit = 'contain',
  ...props
}: VideoEmbedProps) {
  const {
    maxWidth,
    maxHeight,
    height: explicitHeight,
    alignSelf: alignSelfProp,
    ...rest
  } = props;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const durationLabel = makePrettyDurationFromSeconds(video.duration);
  const aspectRatio = video.height > 0 ? video.width / video.height : 1;
  const constrainedSize = resolveConstrainedVideoSize({
    maxWidth,
    maxHeight,
    aspectRatio,
  });
  const viewerId = getVideoViewerId(video.src, video.posterUri);
  const shouldFillMedia = constrainedSize != null || explicitHeight != null;
  const naturalMaxWidth =
    !shouldFillMedia && maxWidth == null && video.width > 0
      ? video.width
      : undefined;
  const mediaSizeProps = shouldFillMedia
    ? { height: '100%' as const }
    : { maxWidth, maxHeight, aspectRatio };

  const handlePress = useCallback(() => {
    logger.trackEvent(AnalyticsEvent.VideoPlaybackOpened, {
      src: video.src,
    });
    navigation.navigate('MediaViewer', {
      mediaType: 'video',
      uri: video.src,
      posterUri: video.posterUri,
      viewerId,
    });
  }, [navigation, video.posterUri, video.src, viewerId]);

  const content = (
    <Pressable
      onPress={handlePress}
      group="button"
      borderRadius="$m"
      overflow="hidden"
      backgroundColor={video.posterUri ? 'transparent' : '$secondaryBackground'}
      alignSelf={alignSelfProp ?? 'flex-start'}
      maxWidth={maxWidth ?? naturalMaxWidth}
      width={constrainedSize?.width ?? '100%'}
      height={explicitHeight ?? constrainedSize?.height}
      {...rest}
    >
      {video.posterUri ? (
        <Image
          source={{ uri: video.posterUri }}
          width="100%"
          {...mediaSizeProps}
          backgroundColor="transparent"
          contentFit={contentFit}
          alt={video.alt ?? 'video'}
        />
      ) : (
        <View
          width="100%"
          {...mediaSizeProps}
          backgroundColor="$secondaryBackground"
        />
      )}
      <VideoOverlay durationLabel={durationLabel} />
    </Pressable>
  );

  if (!viewerId) {
    return content;
  }

  return <GestureTrigger id={viewerId}>{content}</GestureTrigger>;
}
