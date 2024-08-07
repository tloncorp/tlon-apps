import { YStack } from 'tamagui';
import { BigPlayButton, Player } from 'video-react';

export default function Video({ url }: { url: string }) {
  // TODO: Implement mobile detection
  const isMobile = false;
  return (
    <YStack flex={1} maxWidth={600} maxHeight={340}>
      <Player playsInline src={url} fluid={false} width={isMobile ? 300 : 600}>
        <BigPlayButton position="center" />
      </Player>
    </YStack>
  );
}
