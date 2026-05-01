import {
  makePrettyTimeFromMs,
  useMutableCallback,
  useMutableRef,
} from '@tloncorp/shared';
import { Button, ForwardingProps, Pressable, Text, View } from '@tloncorp/ui';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useAppStatusChange } from 'packages/app/hooks/useAppStatusChange';
import {
  ComponentProps,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useTheme } from 'tamagui';

import {
  FinishMode,
  IWaveformRef,
  PlayerState,
  RecorderState,
  Waveform,
  hasRNWaveformNativeModule,
  useExtractWaveformDataCallback,
} from './react-native-audio-waveform';

type State =
  | {
      live: true;
      recorderState: RecorderState;
      duration: { elapsed: number; playbackStartedAt?: Date };
    }
  | { live: false; playbackState: PlayerState; audioFilePath: string };

interface AudioRecorderMethods {
  enterRecordingMode(): void;
  enterPlaybackMode(audioFilePath: string): void;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;
  startPlayback(): Promise<void>;
  stopPlayback(): Promise<void>;
  pausePlayback(): Promise<void>;
  resumePlayback(): Promise<void>;
}

export const AudioRecorder = forwardRef<
  AudioRecorderMethods,
  ForwardingProps<
    typeof View,
    {
      ref?: React.Ref<AudioRecorderMethods>;
      onSubmit?: (opts: {
        audioFilePath: string;
        waveformPreview?: number[];
      }) => void;
      onCancel?: (audioFilePath: string | null) => void;
      dangerouslyOverrideIsAudioAvailable?: boolean;
      /** If provided, will use this number as a paddingHorizontal *except* for
       * leading edge of waveform. Use this instead of paddingHorizontal to
       * show waveform starting flush against the left edge of the container
       * while still having padding on the right edge. */
      contentInsetHorizontal?: number;
    } & (
      | {
          startInRecordingMode: true;
          startInPlaybackModeWithFilePath?: undefined;
        }
      | {
          startInPlaybackModeWithFilePath: string;
          startInRecordingMode?: undefined;
        }
    )
  >
>(function AudioRecorder(
  {
    startInRecordingMode,
    startInPlaybackModeWithFilePath,
    onCancel,
    onSubmit,
    dangerouslyOverrideIsAudioAvailable:
      isAudioAvailable = hasRNWaveformNativeModule,
    contentInsetHorizontal = 20.5,
    ...forwardedProps
  },
  ref
) {
  const theme = useTheme();
  const [renderKey, incrementRenderKey] = useReducer((x) => x + 1, 0);

  const [state, setState] = useState<State>(() =>
    startInRecordingMode
      ? {
          live: true,
          recorderState: RecorderState.stopped,
          duration: { elapsed: 0 },
        }
      : {
          live: false,
          playbackState: PlayerState.stopped,
          audioFilePath: startInPlaybackModeWithFilePath,
        }
  );

  const [elapsedMs, setElapsedMs] = useState<null | number>(null);
  useTimer({
    start: state.live ? state.duration.playbackStartedAt : undefined,
    onTick: (elapsed) => {
      setElapsedMs(
        elapsed +
          (state.live && state.duration != null ? state.duration.elapsed : 0)
      );
    },
  });

  // NB: `refApi`'s methods are probably what you want instead of this (since they coordinate other state)
  const waveformRef = useRef<IWaveformRef>(null);
  const extractWaveformData = useExtractWaveformDataCallback();

  const refApi = useMemo(
    () => ({
      enterRecordingMode() {
        setState({
          live: true,
          recorderState: RecorderState.stopped,
          duration: { elapsed: 0 },
        });
        incrementRenderKey();
      },
      enterPlaybackMode(audioFilePath: string) {
        setState({
          live: false,
          playbackState: PlayerState.stopped,
          audioFilePath,
        });
      },
      async startRecording() {
        try {
          let permissionsResponse = await getRecordingPermissionsAsync();

          if (!permissionsResponse.granted && permissionsResponse.canAskAgain) {
            permissionsResponse = await requestRecordingPermissionsAsync();
          }

          if (!permissionsResponse.granted) {
            Alert.alert(
              'Missing microphone access',
              "Enable microphone access in your device's settings to record audio."
            );
            onCancel?.(null);
            return;
          }

          await waveformRef.current?.startRecord();
        } catch (error) {
          // cancel to avoid trapping user (user can't exit recording mode
          // without stopping record)
          Alert.alert('Failed to start recording');
          onCancel?.(null);
        }
      },
      async stopRecording() {
        const uri = await waveformRef.current?.stopRecord();
        if (uri == null) {
          console.warn('No uri returned from stopRecord');
          Alert.alert('Failed to save recording');
          onCancel?.(null);
          return;
        }
        setElapsedMs(0);
        setState({
          live: false,
          playbackState: PlayerState.stopped,
          audioFilePath: uri, // we're mixing up uri / path here, but rn-waveform quietly converts so it's fine
        });
      },
      async pauseRecording() {
        await waveformRef.current?.pauseRecord();
      },
      async resumeRecording() {
        await waveformRef.current?.resumeRecord();
      },
      async startPlayback() {
        await waveformRef.current?.startPlayer({
          finishMode: FinishMode.stop,
        });
      },
      async stopPlayback() {
        await waveformRef.current?.stopPlayer();
      },
      async pausePlayback() {
        await waveformRef.current?.pausePlayer();
      },
      async resumePlayback() {
        await waveformRef.current?.resumePlayer();
      },
    }),
    [onCancel]
  );

  useImperativeHandle(ref, () => refApi);

  const onRecorderStateChange = useCallback((recorderState: RecorderState) => {
    setState((prev) => {
      if (!prev.live) return prev;
      return {
        ...prev,
        recorderState,
        duration: (() => {
          switch (recorderState) {
            case RecorderState.stopped:
              return { elapsed: 0 };

            case RecorderState.recording:
              return {
                elapsed:
                  prev.duration.elapsed +
                  (prev.duration.playbackStartedAt == null
                    ? 0
                    : Date.now() - prev.duration.playbackStartedAt.getTime()),
                playbackStartedAt: new Date(),
              };

            case RecorderState.paused:
              return {
                elapsed:
                  prev.duration.elapsed +
                  (prev.duration.playbackStartedAt == null
                    ? 0
                    : Date.now() - prev.duration.playbackStartedAt.getTime()),
                playbackStartedAt: undefined,
              };
          }
        })(),
      };
    });
  }, []);

  const onPlayerStateChange = useCallback((playbackState: PlayerState) => {
    setState((prev) => {
      if (prev.live) return prev;
      return { ...prev, playbackState };
    });
  }, []);

  const primaryAction = useMemo<'record' | 'stop-record' | 'submit'>(() => {
    if (state.live) {
      switch (state.recorderState) {
        case RecorderState.stopped:
        case RecorderState.paused:
          return 'record';
        case RecorderState.recording:
          return 'stop-record';
      }
    } else {
      return 'submit';
    }
  }, [state]);

  const onPressPrimaryActionButton = useCallback(async () => {
    if (state.live) {
      switch (primaryAction) {
        case 'record':
          await refApi.startRecording();
          break;

        case 'stop-record':
          await refApi.stopRecording();
          break;

        case 'submit':
          throw new Error(
            `Invalid primary action ${primaryAction} for live AudioRecorder`
          );
      }
    } else {
      const waveformPreview = await (async () => {
        const multichannelWaveformData = await extractWaveformData?.({
          playerKey: `PlayerFor${state.audioFilePath}`,
          path: state.audioFilePath,
          noOfSamples: 50,
        });
        if (
          multichannelWaveformData == null ||
          multichannelWaveformData.length === 0
        ) {
          return undefined;
        }
        // average across channels to produce a mono waveform preview
        return multichannelWaveformData[0].map(
          (frame, i) =>
            multichannelWaveformData.reduce(
              (acc, channel) => acc + (channel[i] ?? 0),
              0
            ) / multichannelWaveformData.length
        );
      })();
      onSubmit?.({ audioFilePath: state.audioFilePath, waveformPreview });
    }
  }, [primaryAction, refApi, state, onSubmit, extractWaveformData]);

  // changing `onCurrentProgressChange` identity resets Waveform's internal playback
  const onCurrentProgressChange = useMutableCallback((elapsed: number) => {
    setElapsedMs(elapsed);
  });

  const audioFilePath = !state.live ? state.audioFilePath : undefined;
  const waveformConfig = useMemo<ComponentProps<typeof Waveform>>(
    () =>
      state.live
        ? {
            mode: 'live',
            path: null,
            onRecorderStateChange,
            candleHeightScale: 1.5,
          }
        : {
            mode: 'static',
            path: audioFilePath!,
            onPlayerStateChange,
            showsHorizontalScrollIndicator: false,
            onCurrentProgressChange,
            onError: (error) => {
              console.error('Waveform error', error);
            },
          },
    [
      state.live,
      audioFilePath,
      onRecorderStateChange,
      onPlayerStateChange,
      onCurrentProgressChange,
    ]
  );

  const progressLabel = useMemo(
    () => makePrettyTimeFromMs(elapsedMs ?? 0),
    [elapsedMs]
  );

  useAppStatusChange(
    useCallback(
      (status) => {
        if (
          status === 'background' &&
          state.live &&
          state.recorderState === RecorderState.recording
        ) {
          refApi.stopRecording().catch((error) => {
            console.error('Failed to stop recording on app background', error);
          });
        }
      },
      [refApi, state]
    )
  );

  return (
    <View
      flexDirection="row"
      gap={8}
      alignItems="center"
      position="relative"
      {...(contentInsetHorizontal == null
        ? null
        : {
            paddingStart: state.live ? undefined : contentInsetHorizontal,
            paddingEnd: contentInsetHorizontal,
          })}
      {...forwardedProps}
    >
      {!state.live && (
        <Button
          iconOnly
          circular
          intent="secondary"
          size="small"
          icon="Close"
          onPress={() => {
            if (onCancel) {
              onCancel(state.audioFilePath);
            } else {
              refApi.enterRecordingMode();
            }
          }}
        />
      )}
      {!state.live && (
        <Button
          disabled={!isAudioAvailable}
          iconOnly
          circular
          size="small"
          intent="positive"
          icon={state.playbackState === PlayerState.playing ? 'Stop' : 'Play'}
          onPress={
            state.playbackState === PlayerState.playing
              ? refApi.stopPlayback
              : refApi.startPlayback
          }
        />
      )}
      <Pressable
        flex={1}
        alignSelf="stretch"
        onPress={() => {
          isAudioAvailable && refApi.startPlayback();
        }}
        disabled={state.live || !isAudioAvailable}
        disabledStyle={{ cursor: 'default' }}
      >
        <Waveform
          // Waveform internally assumes `path` does not change
          key={[audioFilePath, renderKey].join('-')}
          ref={waveformRef}
          candleWidth={3}
          containerStyle={{ flex: 1, pointerEvents: 'none' }}
          inactive={{
            waveColor: theme.tertiaryText.val,
            scrubColor: theme.tertiaryText.val,
          }}
          {...waveformConfig}
        />
      </Pressable>
      <Text
        fontVariant={
          // keeps numbers monospaced to prevent layout shift when digits change
          ['tabular-nums']
        }
        style={
          state.live && state.recorderState === RecorderState.recording
            ? { color: 'red' }
            : undefined
        }
      >
        {progressLabel}
      </Text>
      <Button
        disabled={!isAudioAvailable}
        iconOnly
        circular
        size="small"
        intent={primaryAction === 'stop-record' ? 'overwrite' : undefined}
        icon={(() => {
          switch (primaryAction) {
            case 'record':
              return 'Record';
            case 'stop-record':
              return 'Stop';
            case 'submit':
              return 'ArrowUp';
          }
        })()}
        onPress={onPressPrimaryActionButton}
      />

      {!isAudioAvailable && (
        <View
          style={StyleSheet.absoluteFill}
          backgroundColor="white"
          opacity={0.8}
          alignItems="center"
          justifyContent="center"
        >
          <Text textAlign="center" cursor="default">
            Audio recording/playback is not supported on this platform.
          </Text>
        </View>
      )}
    </View>
  );
});

function useTimer({
  start,
  intervalMs = 1000,
  onTick,
}: {
  start?: Date;
  intervalMs?: number;
  onTick?: (elapsed: number, start: Date) => void;
}): void {
  const onTickRef = useMutableRef(onTick);
  useEffect(() => {
    if (start == null) {
      return;
    }

    // Wait for the next aligned tick (setTimeout), then schedule regular ticks (setInterval).
    let intervalId: NodeJS.Timeout | null = null;
    const remainder = (Date.now() - start.getTime()) % intervalMs;
    const nextTickTime = (intervalMs - remainder) % intervalMs;
    const timeoutId = setTimeout(() => {
      onTickRef.current?.(Date.now() - start.getTime(), start);
      intervalId = setInterval(() => {
        onTickRef.current?.(Date.now() - start.getTime(), start);
      }, intervalMs);
    }, nextTickTime);

    return () => {
      clearTimeout(timeoutId);
      intervalId != null && clearInterval(intervalId);
    };
  }, [start, intervalMs, onTickRef]);
}
