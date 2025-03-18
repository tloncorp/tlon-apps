import { useIsWindowNarrow } from '@tloncorp/ui';
import { ElementRef, useCallback, useRef } from 'react';
import { useWindowDimensions } from 'tamagui';

import * as shared from './AudioEmbedShared';
import { AudioPlayer } from './AudioPlayer';
import { Embed } from './Embed';

export type { AudioPlayerHandle } from './AudioEmbedShared';

const AudioEmbed: shared.AudioEmbed = ({ url }: { url: string }) => {
  const playerRef = useRef<ElementRef<typeof AudioPlayer>>(null);
  const { width } = useWindowDimensions();

  const openLink = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isWindowNarrow = useIsWindowNarrow();
  const embedWidth = isWindowNarrow ? width - 64 : 400;

  return (
    <Embed height={136} width={embedWidth}>
      <Embed.Header onPress={openLink}>
        <Embed.Title>Audio</Embed.Title>
        <Embed.PopOutIcon type="ArrowRef" />
      </Embed.Header>
      <Embed.Preview
        onPress={useCallback(() => playerRef.current?.togglePlayPause(), [])}
        width="100%"
        justifyContent="center"
        alignItems="center"
      >
        <AudioPlayer ref={playerRef} url={url} />
      </Embed.Preview>
    </Embed>
  );
};

export default AudioEmbed;
