import * as api from '@tloncorp/shared/api';
import * as domain from '@tloncorp/shared/domain';
import { AVPlaybackStatus, Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Circle, ScrollView, Stack, View, YStack, ZStack } from 'tamagui';

import { useStore } from '../contexts';
import { TextInputWithIcon } from './Form';
import { Icon } from './Icon';
import { ListItem } from './ListItem';
import { LoadingSpinner } from './LoadingSpinner';
import Pressable from './Pressable';
import { ScreenHeader } from './ScreenHeader';
import { SearchBar } from './SearchBar';
import { Text } from './TextV2';
import { WidgetPane } from './WidgetPane';

interface AugmentedTrack extends api.NormalizedTrack {
  selected: boolean;
}

export function AddProfileAudioScreenView(props: {
  initialTunes?: domain.NormalizedTrack[];
  goBack: () => void;
}) {
  const store = useStore();
  const { query, setQuery, tracks, isLoading, hasMore, loadMore } =
    store.useMusicSearch('');
  const [selectedTracks, setSelectedTracks] = useState<api.NormalizedTrack[]>(
    props.initialTunes ?? []
  );
  const selectedSet = useMemo(
    () => new Set(selectedTracks.map((track) => track.id)),
    [selectedTracks]
  );
  const augmentedTracks: AugmentedTrack[] = useMemo(() => {
    return tracks.map((track) => ({
      ...track,
      selected: selectedSet.has(track.id),
    }));
  }, [tracks, selectedSet]);

  const save = useCallback(async () => {
    store.updateProfilePinnedTunes(selectedTracks);
    props.goBack();
  }, [props, selectedTracks, store]);

  const player = useAudioPlayer();

  const pressSelectTrack = useCallback(
    (track: AugmentedTrack) => {
      if (selectedSet.has(track.id)) {
        setSelectedTracks(() =>
          selectedTracks.filter(
            (selectedTrack) => selectedTrack.id !== track.id
          )
        );
      } else {
        setSelectedTracks([...selectedTracks, track]);
      }
    },
    [selectedSet, selectedTracks]
  );

  return (
    <View flex={1}>
      <ScreenHeader
        title="Pinned Tunes"
        backAction={() => props.goBack()}
        rightControls={
          <ScreenHeader.TextButton onPress={save}>Done</ScreenHeader.TextButton>
        }
      />
      <YStack flex={1} gap="$l">
        <View marginHorizontal="$l">
          <TextInputWithIcon
            icon="Search"
            placeholder="Search catalog..."
            value={query}
            onChangeText={setQuery}
            spellCheck={false}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
          />
        </View>
        <View>
          <SelectedTracks
            tracks={selectedTracks}
            player={player}
            removeTrack={pressSelectTrack}
          />
        </View>
        <FlatList
          style={{ flex: 1 }}
          data={augmentedTracks}
          renderItem={({ item }: { item: AugmentedTrack }) => (
            <TrackListTrack
              key={item.id}
              track={item}
              player={player}
              onPressSelect={pressSelectTrack}
            />
          )}
          keyExtractor={(item) => item.id}
          onEndReached={hasMore ? loadMore : undefined}
        />
        {isLoading && <LoadingSpinner />}
      </YStack>
    </View>
  );
}

export function TrackListTrack(props: {
  track: AugmentedTrack;
  player: ReturnType<typeof useAudioPlayer>;
  onPressSelect: (track: AugmentedTrack) => void;
}) {
  const { track, player } = props;

  const pressTrack = useCallback(() => {
    player.currentTrack === track
      ? player.isPlaying
        ? player.pause()
        : player.resume()
      : player.playTrack(track);
  }, [player, track]);

  return (
    <Pressable key={track.id} onPress={pressTrack}>
      <ListItem>
        <ListItem.ImageIcon imageUrl={track.coverArt} />
        <ListItem.MainContent>
          <ListItem.Title>{track.title}</ListItem.Title>
          <ListItem.Subtitle>{track.artist}</ListItem.Subtitle>
        </ListItem.MainContent>
        <ListItem.EndContent onPress={() => props.onPressSelect(track)}>
          <ListItem.SystemIcon backgroundColor="unset" icon="Add" />
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

export function SelectedTracks(props: {
  tracks: api.NormalizedTrack[];
  player: ReturnType<typeof useAudioPlayer>;
  removeTrack: (track: api.NormalizedTrack) => void;
}) {
  const { player } = props;

  const pressTrack = useCallback(
    (track: api.NormalizedTrack) => {
      player.currentTrack === track
        ? player.isPlaying
          ? player.pause()
          : player.resume()
        : player.playTrack(track);
    },
    [player]
  );

  return (
    <WidgetPane
      marginHorizontal="$l"
      height={120}
      backgroundColor="$secondaryBackground"
    >
      {props.tracks.length > 0 ? (
        <ScrollView horizontal gap="$2xl">
          <View flexDirection="row" gap="$l">
            {props.tracks.map((track) => (
              <MiniPlayableTrack
                key={track.id}
                track={track}
                player={player}
                onPress={pressTrack}
                size={60}
                removable
                onRemove={props.removeTrack}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <Stack flex={1} justifyContent="center" alignItems="center">
          <Text color="$tertiaryText">No tunes in your jukebox</Text>
        </Stack>
      )}
    </WidgetPane>
  );
}

export function MiniPlayableTrack(props: {
  track: api.NormalizedTrack;
  player: ReturnType<typeof useAudioPlayer>;
  size?: number;
  removable?: boolean;
  onRemove?: (track: api.NormalizedTrack) => void;
  onPress?: (track: api.NormalizedTrack) => void;
}) {
  const { track, player } = props;

  const size = props.size ?? 100;
  const rotation = useSharedValue(0);
  const borderRadius = useSharedValue(8);

  useEffect(() => {
    if (player.isPlaying && player.currentTrack?.id === track.id) {
      // collapse to circle
      borderRadius.value = withSpring(size / 2, {
        damping: 20,
        stiffness: 300,
        mass: 0.5,
      });

      // slowly spin
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 8000,
          easing: Easing.linear,
        }),
        -1, // Infinite repetitions
        false // Don't reverse
      );
    } else {
      // Stop at current rotation
      cancelAnimation(rotation);
      // Optional: Spring back to 0 when stopped
      rotation.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        mass: 0.5,
      });
      borderRadius.value = withDelay(
        200,
        withSpring(8, {
          damping: 20,
          stiffness: 300,
          mass: 0.5,
        })
      );
    }
  }, [
    player.isPlaying,
    player.currentTrack?.id,
    track.id,
    rotation,
    borderRadius,
    size,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${rotation.value}deg`,
      },
    ],
  }));

  const pressTrack = useCallback(() => {
    player.currentTrack === track
      ? player.isPlaying
        ? player.pause()
        : player.resume()
      : player.playTrack(track);
  }, [player, track]);

  return (
    <Pressable onPress={pressTrack}>
      <ZStack height={size} width={size}>
        <YStack>
          <Animated.View style={[animatedStyle, { borderRadius: 8 }]}>
            <Animated.Image
              source={{ uri: track.coverArt }}
              style={{
                height: size,
                width: size,
                borderRadius,
              }}
            />
          </Animated.View>
          {/* <View width={100}>
          <Text textOverflow="ellipsis">{track.title}</Text>
        </View> */}
        </YStack>
        {props.removable && (
          <Pressable
            onPress={() => props.onRemove?.(track)}
            position="relative"
            left={size - 12}
          >
            <Circle size="$xl" backgroundColor="$gray300">
              <Icon type="Close" size="$s" />
            </Circle>
          </Pressable>
        )}
      </ZStack>
    </Pressable>
  );
}

interface AudioPlayerState {
  isPlaying: boolean;
  currentTrack: api.NormalizedTrack | null;
  sound: Audio.Sound | null;
}

function useAudioPlayer() {
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTrack: null,
    sound: null,
  });

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (state.sound) {
        state.sound.unloadAsync();
      }
    };
  }, []);

  const playTrack = async (track: api.NormalizedTrack) => {
    try {
      // If we're already playing this track, just pause/resume
      if (state.currentTrack?.id === track.id && state.sound) {
        if (state.isPlaying) {
          await state.sound.pauseAsync();
          setState((prev) => ({ ...prev, isPlaying: false }));
        } else {
          await state.sound.playAsync();
          setState((prev) => ({ ...prev, isPlaying: true }));
        }
        return;
      }

      // Unload any existing sound
      if (state.sound) {
        await state.sound.unloadAsync();
      }

      // Load and play the new track
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          // This is our playback status callback
          if (status.isLoaded && status.didJustFinish) {
            setState((prev) => ({ ...prev, isPlaying: false }));
          }
        }
      );

      setState({
        sound,
        currentTrack: track,
        isPlaying: true,
      });
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const pause = async () => {
    if (state.sound) {
      await state.sound.pauseAsync();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  const resume = async () => {
    if (state.sound) {
      await state.sound.playAsync();
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  };

  const stop = async () => {
    if (state.sound) {
      await state.sound.stopAsync();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  };

  return {
    playTrack,
    pause,
    resume,
    stop,
    isPlaying: state.isPlaying,
    currentTrack: state.currentTrack,
  };
}
