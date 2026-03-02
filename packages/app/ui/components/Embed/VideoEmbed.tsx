import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import { Icon, Pressable } from '@tloncorp/ui';
import { ComponentProps, useState } from 'react';
import { View } from 'tamagui';

type VideoEmbedProps = ComponentProps<typeof View> & {
  video: { width: number; height: number; src: string; alt?: string };
};
const logger = createDevLogger('VideoEmbedWeb', false);

export default function Video({ video }: VideoEmbedProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          setIsOpen(true);
          logger.trackEvent(AnalyticsEvent.VideoPlaybackOpened, {
            src: video.src,
          });
        }}
        group="button"
        borderRadius="$m"
        overflow="hidden"
        backgroundColor="$secondaryBackground"
      >
        <video
          src={video.src}
          preload="metadata"
          muted
          playsInline
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 600,
            maxHeight: 340,
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
            backgroundColor="$mediaScrim"
            color="$white"
            borderRadius={100}
            customSize={['$4xl', '$4xl']}
            $group-button-press={{ opacity: 0.8 }}
          />
        </View>
      </Pressable>
      {isOpen ? (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(1100px, 100%)',
              maxHeight: '90vh',
            }}
          >
            <video
              src={video.src}
              controls
              autoPlay
              onPlay={() => {
                logger.trackEvent(AnalyticsEvent.VideoPlaybackStarted, {
                  src: video.src,
                });
              }}
              onError={(event) => {
                logger.trackEvent(AnalyticsEvent.VideoPlaybackError, {
                  src: video.src,
                  error: event,
                });
              }}
              style={{
                width: '100%',
                maxHeight: '90vh',
                display: 'block',
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
