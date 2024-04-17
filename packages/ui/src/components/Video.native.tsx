import { Image } from '@tloncorp/shared/dist/urbit/channel';
import { AVPlaybackStatus, Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useEffect, useRef, useState } from 'react';

import { View } from '../core';

export default function Video({ block }: { block: Image }) {
  const videoRef = useRef<ExpoVideo | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus>();

  console.log({ playbackStatus });

  useEffect(() => {
    if (!videoRef.current || !playbackStatus || !playbackStatus.isLoaded) {
      return;
    }

    if (playbackStatus.isPlaying) {
      videoRef.current?.presentFullscreenPlayer();
    }

    if (playbackStatus.didJustFinish) {
      videoRef.current?.dismissFullscreenPlayer();
    }
  }, [playbackStatus]);

  return (
    <View flex={1}>
      <ExpoVideo
        ref={videoRef}
        source={{ uri: block.image.src }}
        rate={1.0}
        volume={1.0}
        isMuted={false}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls
        onFullscreenUpdate={(event) => {
          if (event.fullscreenUpdate === 2) {
            videoRef.current?.pauseAsync();
          }
        }}
        onPlaybackStatusUpdate={(status) => {
          setPlaybackStatus(status);
        }}
        style={{ width: 200, height: 200 }}
      />
    </View>
  );
}
