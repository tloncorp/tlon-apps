import { makePrettyTimeFromMs } from '@tloncorp/api/lib/utils';
import type * as cn from '@tloncorp/shared/logic';
import { Icon, Image, Pressable, Text } from '@tloncorp/ui';
import { ComponentProps, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  LayoutChangeEvent,
  Linking,
  PanResponder,
  Platform,
} from 'react-native';
import { View, XStack, YStack, styled } from 'tamagui';

import { useNowPlayingController } from '../../contexts/nowPlaying';
import { ActionSheet } from '../ActionSheet';
import { Reference } from '../ContentReference/Reference';

type Music = cn.MusicBlockData['music'];
type MusicTrack = NonNullable<Music['tracks']>[number];

const KIND_LABELS = {
  artist: 'Artist',
  release: 'Release',
  album: 'Album',
  track: 'Track',
  playlist: 'Playlist',
} satisfies Record<Music['kind'], string>;

export function MusicBlock({
  block,
  ...props
}: { block: cn.MusicBlockData } & ComponentProps<typeof Reference.Frame>) {
  const music = block.music;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const subtitle = useMemo(() => musicSubtitle(music), [music]);
  const primaryPreviewUrl = useMemo(() => getPreviewUrl(music), [music]);
  const tracks = music.tracks ?? [];
  const hasTrackDetails =
    (music.kind === 'release' ||
      music.kind === 'album' ||
      music.kind === 'playlist') &&
    tracks.length > 0;

  const handleOpenExternal = useCallback(() => {
    openExternalUrl(music.externalUrl);
  }, [music.externalUrl]);
  const handleOpenDetails = useCallback(() => {
    if (hasTrackDetails) {
      setDetailsOpen(true);
    }
  }, [hasTrackDetails]);

  return (
    <>
      <Reference.Frame {...props}>
        <Reference.Header alignItems="center">
          <Reference.Title>
            <Reference.TitleIcon type="Wave" />
            <Reference.TitleText>{KIND_LABELS[music.kind]}</Reference.TitleText>
          </Reference.Title>
          {music.externalUrl ? (
            <Pressable onPress={handleOpenExternal}>
              <Reference.ActionIcon type="ArrowRef" />
            </Pressable>
          ) : null}
        </Reference.Header>

        <Reference.Body pointerEvents="auto" padding="$l">
          <Pressable
            disabled={!hasTrackDetails}
            cursor={hasTrackDetails ? 'pointer' : 'default'}
            onPress={handleOpenDetails}
          >
            <XStack gap="$l" alignItems="center">
              <MusicArtwork coverArtUrl={music.coverArtUrl} size={76} />

              <YStack flex={1} minWidth={0} gap="$s">
                <Text size="$label/m" fontWeight="600" numberOfLines={2}>
                  {music.title}
                </Text>
                {subtitle ? (
                  <Text
                    size="$label/m"
                    color="$secondaryText"
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                ) : null}
                {music.description ? (
                  <Text size="$label/s" color="$tertiaryText" numberOfLines={2}>
                    {music.description}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
          </Pressable>

          {hasTrackDetails ? (
            <MusicInlineTrackList
              tracks={tracks}
              kind={music.kind}
              onOpenDetails={handleOpenDetails}
            />
          ) : primaryPreviewUrl ? (
            <MusicPlaybackRow
              sourceUri={primaryPreviewUrl}
              fallbackDuration={music.duration}
            />
          ) : null}
        </Reference.Body>
      </Reference.Frame>

      {hasTrackDetails ? (
        <MusicDetailSheet
          music={music}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      ) : null}
    </>
  );
}

function MusicDetailSheet({
  music,
  open,
  onOpenChange,
}: {
  music: Music;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const subtitle = musicSubtitle(music);

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      closeButton
      title={music.title}
      dialogContentProps={{ width: '90%', maxWidth: 640, minWidth: 360 }}
    >
      <ActionSheet.SimpleHeader title={music.title} subtitle={subtitle} />
      <ActionSheet.ScrollableContent>
        <ActionSheet.ContentBlock>
          <XStack gap="$l" alignItems="center">
            <MusicArtwork coverArtUrl={music.coverArtUrl} size={96} />
            <YStack flex={1} minWidth={0} gap="$s">
              <Text size="$label/m" color="$tertiaryText">
                {KIND_LABELS[music.kind]}
              </Text>
              <Text size="$label/m" fontWeight="600" numberOfLines={2}>
                {music.title}
              </Text>
              {music.description ? (
                <Text size="$label/s" color="$secondaryText">
                  {music.description}
                </Text>
              ) : null}
            </YStack>
          </XStack>
        </ActionSheet.ContentBlock>

        <ActionSheet.ContentBlock paddingTop={0}>
          <TrackListFrame>
            {music.tracks?.map((track, index) => (
              <MusicTrackRow
                key={track.id ?? `${track.title}-${index}`}
                track={track}
                index={index}
                isLast={index === (music.tracks?.length ?? 0) - 1}
                showRelease
              />
            ))}
          </TrackListFrame>
        </ActionSheet.ContentBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

function MusicInlineTrackList({
  tracks,
  kind,
  onOpenDetails,
}: {
  tracks: MusicTrack[];
  kind: Music['kind'];
  onOpenDetails: () => void;
}) {
  return (
    <YStack marginTop="$l" gap="$s">
      <MiniTrackListFrame>
        {tracks.map((track, index) => (
          <MusicTrackRow
            key={track.id ?? `${track.title}-${index}`}
            track={track}
            index={index}
            isLast={index === tracks.length - 1}
          />
        ))}
      </MiniTrackListFrame>
      <Pressable alignSelf="flex-start" onPress={onOpenDetails}>
        <Text size="$label/s" color="$tertiaryText">
          {detailButtonLabel(kind)}
        </Text>
      </Pressable>
    </YStack>
  );
}

function MusicTrackRow({
  track,
  index,
  isLast,
  showRelease = false,
}: {
  track: MusicTrack;
  index: number;
  isLast: boolean;
  showRelease?: boolean;
}) {
  const sourceUri = track.previewUrl ?? track.audioUrl ?? null;
  const subtitle = [
    artistNames(track.artists),
    showRelease ? track.releaseTitle : null,
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <YStack
      padding="$l"
      gap="$s"
      borderBottomWidth={isLast ? 0 : 1}
      borderBottomColor="$secondaryBorder"
    >
      <XStack gap="$m" alignItems="center">
        <Text
          width={24}
          size="$label/s"
          color="$tertiaryText"
          textAlign="right"
        >
          {track.trackNumber ?? index + 1}
        </Text>
        <YStack flex={1} minWidth={0} gap="$2xs">
          <Text size="$label/m" numberOfLines={1}>
            {track.title}
          </Text>
          {subtitle ? (
            <Text size="$label/s" color="$tertiaryText" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
        {track.duration != null ? (
          <Text size="$label/s" color="$tertiaryText">
            {makePrettyTimeFromMs(track.duration * 1000)}
          </Text>
        ) : null}
        {sourceUri ? <MusicPlayButton sourceUri={sourceUri} compact /> : null}
      </XStack>
      {sourceUri ? (
        <MusicScrubber
          sourceUri={sourceUri}
          fallbackDuration={track.duration}
          compact
        />
      ) : null}
    </YStack>
  );
}

function MusicPlaybackRow({
  sourceUri,
  fallbackDuration,
}: {
  sourceUri: string;
  fallbackDuration?: number;
}) {
  return (
    <XStack gap="$m" alignItems="center" marginTop="$l">
      <MusicPlayButton sourceUri={sourceUri} />
      <MusicScrubber
        sourceUri={sourceUri}
        fallbackDuration={fallbackDuration}
        visibleWhenInactive
      />
    </XStack>
  );
}

function MusicPlayButton({
  sourceUri,
  compact = false,
}: {
  sourceUri: string;
  compact?: boolean;
}) {
  const { togglePlayback, status } = useNowPlayingController({ sourceUri });

  return (
    <Pressable
      width={compact ? '$3xl' : '$4xl'}
      aspectRatio={1}
      alignItems="center"
      justifyContent="center"
      borderRadius={8}
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$border"
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$secondaryBackground' }}
      pressStyle={{ opacity: 0.6 }}
      onPress={togglePlayback}
    >
      {status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <Icon
          type={status === 'playing' ? 'Stop' : 'Play'}
          color="$primaryText"
          size={compact ? '$s' : '$m'}
        />
      )}
    </Pressable>
  );
}

function MusicScrubber({
  sourceUri,
  fallbackDuration,
  compact = false,
  visibleWhenInactive = false,
}: {
  sourceUri: string;
  fallbackDuration?: number;
  compact?: boolean;
  visibleWhenInactive?: boolean;
}) {
  const { progress, seekTo, isThisSourceLoaded } = useNowPlayingController({
    sourceUri,
  });
  const [barWidth, setBarWidth] = useState(0);
  const [draggingTime, setDraggingTime] = useState<number | null>(null);
  const seekGenRef = useRef(0);

  const loadedProgress =
    isThisSourceLoaded && progress?.loadState === 'loaded' ? progress : null;
  const duration = loadedProgress?.duration ?? fallbackDuration ?? 0;
  const displayedTime = draggingTime ?? loadedProgress?.currentTime ?? 0;
  const disabled = !loadedProgress || duration <= 0 || barWidth <= 0;
  const percent =
    duration > 0
      ? `${clampNumber(displayedTime / duration, 0, 1) * 100}%`
      : '0%';

  const seekFromLocation = useCallback(
    (locationX: number) => {
      if (disabled) {
        return;
      }
      const nextTime = clampNumber(locationX / barWidth, 0, 1) * duration;
      const seekGen = ++seekGenRef.current;
      setDraggingTime(nextTime);
      seekTo(nextTime).finally(() => {
        if (seekGenRef.current === seekGen) {
          setDraggingTime(null);
        }
      });
    },
    [barWidth, disabled, duration, seekTo]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          seekFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          seekFromLocation(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          setDraggingTime(null);
        },
        onPanResponderTerminate: () => {
          setDraggingTime(null);
        },
      }),
    [disabled, seekFromLocation]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  }, []);

  if (!visibleWhenInactive && !isThisSourceLoaded) {
    return null;
  }

  if (duration <= 0) {
    return null;
  }

  return (
    <YStack flex={1} minWidth={0} gap="$2xs">
      <ScrubberTrack
        height={compact ? 4 : 6}
        opacity={disabled ? 0.5 : 1}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <ScrubberFill style={{ width: percent }} />
      </ScrubberTrack>
      {!compact ? (
        <XStack justifyContent="space-between">
          <Text size="$label/s" color="$tertiaryText">
            {makePrettyTimeFromMs(displayedTime * 1000)}
          </Text>
          <Text size="$label/s" color="$tertiaryText">
            {makePrettyTimeFromMs(duration * 1000)}
          </Text>
        </XStack>
      ) : null}
    </YStack>
  );
}

function MusicArtwork({
  coverArtUrl,
  size,
}: {
  coverArtUrl?: string;
  size: number;
}) {
  return (
    <ArtworkFrame width={size} height={size}>
      {coverArtUrl ? (
        <Image
          source={{ uri: coverArtUrl }}
          width="100%"
          height="100%"
          contentFit="cover"
          fallback={<MusicArtworkFallback />}
        />
      ) : (
        <MusicArtworkFallback />
      )}
    </ArtworkFrame>
  );
}

function MusicArtworkFallback() {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      backgroundColor="$background"
    >
      <Icon type="Wave" color="$tertiaryText" />
    </YStack>
  );
}

function getPreviewUrl(music: Music): string | null {
  return (
    music.previewUrl ??
    music.audioUrl ??
    music.tracks?.find((track) => track.previewUrl)?.previewUrl ??
    music.tracks?.find((track) => track.audioUrl)?.audioUrl ??
    null
  );
}

function musicSubtitle(music: Music): string | undefined {
  switch (music.kind) {
    case 'artist':
      return music.provider;
    case 'release':
    case 'album':
      return [artistNames(music.artists), releaseYear(music.releasedAt)]
        .filter(Boolean)
        .join(' - ');
    case 'track':
      return [artistNames(music.artists), music.releaseTitle]
        .filter(Boolean)
        .join(' - ');
    case 'playlist':
      return [music.creatorName, trackCountLabel(music)]
        .filter(Boolean)
        .join(' - ');
  }
}

function artistNames(artists?: Music['artists']): string | undefined {
  const names = artists?.map((artist) => artist.name).filter(Boolean);
  return names?.length ? names.join(', ') : undefined;
}

function releaseYear(releasedAt?: string): string | undefined {
  return releasedAt?.match(/^\d{4}/)?.[0];
}

function trackCountLabel(music: Music): string | undefined {
  const count = music.trackCount ?? music.tracks?.length;
  if (count == null) {
    return undefined;
  }
  return count === 1 ? '1 track' : `${count} tracks`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function detailButtonLabel(kind: Music['kind']) {
  switch (kind) {
    case 'album':
      return 'View album';
    case 'playlist':
      return 'View playlist';
    case 'artist':
    case 'release':
    case 'track':
      return 'View release';
  }
}

function openExternalUrl(url?: string) {
  if (!url) {
    return;
  }
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url);
  }
}

const ArtworkFrame = styled(View, {
  borderRadius: '$s',
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: '$background',
});

const TrackListFrame = styled(YStack, {
  borderWidth: 1,
  borderColor: '$border',
  borderRadius: '$s',
  overflow: 'hidden',
});

const MiniTrackListFrame = styled(TrackListFrame, {
  backgroundColor: '$background',
});

const ScrubberTrack = styled(View, {
  backgroundColor: '$border',
  borderRadius: 999,
  overflow: 'hidden',
  width: '100%',
  cursor: 'pointer',
});

const ScrubberFill = styled(View, {
  backgroundColor: '$primaryText',
  height: '100%',
});
