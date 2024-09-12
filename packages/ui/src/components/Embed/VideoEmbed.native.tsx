import {
  Video as ExpoVideo,
  ResizeMode,
  VideoReadyForDisplayEvent,
} from 'expo-av';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'tamagui';

import { Icon } from '../Icon';
import { VideoEmbedProps } from './VideoEmbed';

export default function VideoEmbed({ video, ...props }: VideoEmbedProps) {
  const videoRef = useRef<ExpoVideo | null>(null);
  const [aspect, setAspect] = useState<number | null>(
    video.width / video.height
  );

  const handlePress = useCallback(() => {
    videoRef.current?.presentFullscreenPlayer();
    videoRef.current?.playAsync();
  }, []);

  const handleReadyForDisplay = useCallback((e: VideoReadyForDisplayEvent) => {
    setAspect(e.naturalSize.width / e.naturalSize.height);
  }, []);

  const source = useMemo(() => ({ uri: video.src }), [video.src]);

  return (
    <View
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
    </View>
  );
}
