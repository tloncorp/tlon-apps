import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { Icon } from '@tloncorp/ui';
import { Pressable } from '@tloncorp/ui';
import {
  Video as ExpoVideo,
  ResizeMode,
  VideoReadyForDisplayEvent,
} from 'expo-av';
import { ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'tamagui';

type VideoEmbedProps = ComponentProps<typeof View> & {
  video: { width: number; height: number; src: string; alt?: string };
};
const logger = createDevLogger('VideoEmbedNative', false);

export default function VideoEmbed({ video, ...props }: VideoEmbedProps) {
  const videoRef = useRef<ExpoVideo | null>(null);
  const [aspect, setAspect] = useState<number | null>(
    video.width / video.height
  );

  const handlePress = useCallback(async () => {
    logger.trackEvent(AnalyticsEvent.VideoPlaybackOpened, {
      src: video.src,
    });
    videoRef.current?.presentFullscreenPlayer();
    try {
      await videoRef.current?.playAsync();
      logger.trackEvent(AnalyticsEvent.VideoPlaybackStarted, {
        src: video.src,
      });
    } catch (error) {
      logger.trackEvent(AnalyticsEvent.VideoPlaybackError, {
        src: video.src,
        error,
      });
    }
  }, [video.src]);

  const handleReadyForDisplay = useCallback((e: VideoReadyForDisplayEvent) => {
    setAspect(e.naturalSize.width / e.naturalSize.height);
  }, []);

  const source = useMemo(() => ({ uri: video.src }), [video.src]);

  return (
    <Pressable
      onPress={handlePress}
      group="button"
      borderRadius="$m"
      overflow="hidden"
      backgroundColor={'$secondaryBackground'}
      {...props}
    >
      <ExpoVideo
        ref={videoRef}
        source={source}
        onReadyForDisplay={handleReadyForDisplay}
        onError={(error) => {
          logger.trackEvent(AnalyticsEvent.VideoPlaybackError, {
            src: video.src,
            error,
          });
        }}
        resizeMode={ResizeMode.COVER}
        style={{
          width: '100%',
          aspectRatio: aspect ?? 1,
        }}
      />
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
          backgroundColor={'$mediaScrim'}
          color="$white"
          borderRadius={100}
          customSize={['$4xl', '$4xl']}
          $group-button-press={{ opacity: 0.8 }}
        />
      </View>
    </Pressable>
  );
}
