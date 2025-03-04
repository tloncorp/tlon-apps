import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import { Text, View } from 'tamagui';
import { Icon, LoadingSpinner, Pressable } from '@tloncorp/ui';

import { makePrettyTimeFromMs } from '@tloncorp/shared/logic';
import { AudioPlayerHandle } from './AudioEmbedShared';

export const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  { url: string; canUnload?: boolean }
>(function AudioPlayer({ url, canUnload }, forwardedRef) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<any>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration * 1000);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setError('Error loading audio');
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);

      if (canUnload) {
        audio.pause();
        audio.src = '';
        audio.load();
      }
    };
  }, [canUnload]);

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return { isPlaying: false };

    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
    return { isPlaying: !audio.paused };
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    togglePlayPause: handlePlayPause,
    stop,
  }));

  const handleProgressBarClick = (e: GestureResponderEvent) => {
    const audio = audioRef.current;
    const progressBar = progressBarRef.current;
    if (!audio || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const position = (e.nativeEvent.locationX / rect.width);
    audio.currentTime = position * audio.duration;
  };

  return (
    <View
      padding="$m"
      borderRadius="$l"
      width="100%"
    >
      <audio
        ref={audioRef}
        src={url}
        style={{ display: 'none' }}
      />
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        marginBottom="$s"
      >
        <View flexDirection="row" alignItems="center" flex={1}>
          <View
            backgroundColor="$backgroundStrong"
            borderRadius="$s"
            padding="$s"
            marginRight="$s"
          >
            {isLoading ? (
              <LoadingSpinner size="small" />
            ) : isBuffering ? (
              <LoadingSpinner size="small" />
            ) : isPlaying ? (
              <Icon type="Stop" size="$m" color="$primaryText" />
            ) : (
              <Icon type="Play" size="$m" color="$primaryText" />
            )}
          </View>
          <View flex={1}>
            <Text
              color="$text"
              fontSize="$m"
              fontWeight="$l"
              marginBottom="$xs"
            >
              {isLoading
                ? 'Loading...'
                : isPlaying
                ? 'Now Playing'
                : 'Audio Track'}
            </Text>
            {!isLoading && (
              <>
                <Pressable onPress={handleProgressBarClick}>
                  <View
                    ref={progressBarRef}
                    backgroundColor="$border"
                    height="$xs"
                    borderRadius="$xs"
                    marginBottom="$xs"
                    width="100%"
                    overflow="hidden"
                  >
                    <View
                      backgroundColor="$primaryText"
                      height="100%"
                      width={`${(currentTime / (duration || 1)) * 100}%`}
                    />
                  </View>
                </Pressable>
                <Text color="$textMuted" fontSize="$s">
                  {makePrettyTimeFromMs(currentTime)}
                  {duration ? ` / ${makePrettyTimeFromMs(duration)}` : null}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
      {error ? (
        <Text color="$error" fontSize="$s" textAlign="center">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
