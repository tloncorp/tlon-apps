import { AVPlaybackStatus, Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'tamagui';

import { Icon } from '../Icon';
import { Embed } from './Embed';

export default function Video({ url }: { url: string }) {
  const videoRef = useRef<ExpoVideo | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus>();
  const [showModal, setShowModal] = useState(false);

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
    <Embed height={100}>
      <Embed.Header onPress={() => ({})}>
        <Embed.Title>Video</Embed.Title>
        <Embed.PopOutIcon />
      </Embed.Header>
      <Embed.Preview onPress={() => setShowModal(true)}>
        <Icon type="Play" />
        <Text>Watch</Text>
      </Embed.Preview>
      <Embed.Modal visible={showModal} onDismiss={() => setShowModal(false)}>
        <ExpoVideo
          ref={videoRef}
          source={{ uri: url }}
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
      </Embed.Modal>
    </Embed>
  );
}
