import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { Icon, Image, Pressable } from '@tloncorp/ui';
import { ComponentProps, useCallback, useMemo } from 'react';
import { View } from 'tamagui';

import { RootStackParamList } from '../../../navigation/types';

type VideoEmbedProps = ComponentProps<typeof View> & {
  video: {
    width: number;
    height: number;
    src: string;
    alt?: string;
    posterUri?: string;
  };
};
const logger = createDevLogger('VideoEmbed', false);

export default function VideoEmbed({ video, ...props }: VideoEmbedProps) {
  const { maxWidth, maxHeight, ...rest } = props;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      <View
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="center"
        justifyContent="center"
      >
        <Icon
          type="Play"
          backgroundColor="$mediaScrim"
          color="$white"
          borderRadius={100}
          customSize={['$4xl', '$4xl']}
          $group-button-press={{ opacity: 0.8 }}
        />
      </View>
    </Pressable>
  );
}
