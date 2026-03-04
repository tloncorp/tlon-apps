import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  createDevLogger,
  makePrettyDurationFromSeconds,
} from '@tloncorp/shared';
import { Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { ComponentProps, useCallback, useMemo } from 'react';
import { XStack, View } from 'tamagui';

import { RootStackParamList } from '../../../navigation/types';

type VideoEmbedProps = ComponentProps<typeof View> & {
  video: {
    width: number;
    height: number;
    src: string;
    alt?: string;
    duration?: number;
    posterUri?: string;
  };
};
const logger = createDevLogger('VideoEmbed', false);

export default function VideoEmbed({ video, ...props }: VideoEmbedProps) {
  const { maxWidth, maxHeight, ...rest } = props;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const durationLabel = makePrettyDurationFromSeconds(video.duration);
  const aspectRatio = video.height > 0 ? video.width / video.height : 1;
  const boundedFrame = useMemo(() => {
    if (
      typeof maxWidth !== 'number' ||
      typeof maxHeight !== 'number' ||
      aspectRatio <= 0
    ) {
      return null;
    }
    const width = Math.min(maxWidth, maxHeight * aspectRatio);
    return {
      width,
      height: width / aspectRatio,
    };
  }, [aspectRatio, maxHeight, maxWidth]);

  const handlePress = useCallback(() => {
    logger.trackEvent(AnalyticsEvent.VideoPlaybackOpened, {
      src: video.src,
    });
    navigation.navigate('MediaViewer', {
      mediaType: 'video',
      uri: video.src,
      posterUri: video.posterUri,
    });
  }, [
    navigation,
    video.posterUri,
    video.src,
  ]);

  return (
    <Pressable
      onPress={handlePress}
      group="button"
      borderRadius="$m"
      overflow="hidden"
      backgroundColor="$secondaryBackground"
      alignSelf={boundedFrame ? 'flex-start' : undefined}
      width={boundedFrame?.width}
      height={boundedFrame?.height}
      {...rest}
    >
      {video.posterUri ? (
        <Image
          source={{ uri: video.posterUri }}
          width="100%"
          {...(boundedFrame ? { height: '100%' } : {})}
          {...(!boundedFrame
            ? { maxWidth, maxHeight, aspectRatio }
            : {})}
          backgroundColor="$secondaryBackground"
          contentFit="contain"
          alt={video.alt}
        />
      ) : (
        <View
          width="100%"
          {...(boundedFrame ? { height: '100%' } : {})}
          {...(!boundedFrame
            ? { maxWidth, maxHeight, aspectRatio }
            : {})}
          backgroundColor="$secondaryBackground"
        />
      )}
      <XStack
        position="absolute"
        left={8}
        right={8}
        bottom={8}
        alignItems="center"
        justifyContent="space-between"
        pointerEvents="none"
      >
        <View
          backgroundColor="$mediaScrim"
          borderRadius={100}
          width="$2xl"
          height="$2xl"
          alignItems="center"
          justifyContent="center"
        >
          <Icon type="Play" color="$white" size="$s" />
        </View>
        {durationLabel ? (
          <View
            backgroundColor="$mediaScrim"
            borderRadius="$s"
            paddingHorizontal="$s"
            paddingVertical="$2xs"
          >
            <Text color="$white" fontSize="$s" fontWeight="$xl">
              {durationLabel}
            </Text>
          </View>
        ) : (
          <View />
        )}
      </XStack>
    </Pressable>
  );
}
