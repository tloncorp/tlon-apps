import { Image } from '@tloncorp/shared/dist/urbit/channel';
import { BigPlayButton, Player } from 'video-react';

import { YStack } from '../core';

export default function Video({ block }: { block: Image }) {
  // TODO: Implement mobile detection
  const isMobile = false;
  return (
    <YStack flex={1} maxWidth={600} maxHeight={340}>
      <Player
        playsInline
        src={block.image.src}
        fluid={false}
        width={isMobile ? 300 : 600}
      >
        <BigPlayButton position="center" />
      </Player>
    </YStack>
  );
}
