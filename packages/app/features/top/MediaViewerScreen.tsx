import { ImageZoom, Zoomable } from '@likashefqet/react-native-image-zoom';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  createDevLogger,
  downloadImageForWeb,
  ensureFileExtension,
} from '@tloncorp/shared';
import { Icon, Image, Pressable, Text, triggerHaptic } from '@tloncorp/ui';
// Temporary SDK 52 workaround: expo-video@2.0.6 has a broken root export on web
// (VideoThumbnail). Keep subpath imports until we can move to expo-video>=3.0.0.
import {
  VideoView,
} from 'expo-video/build/VideoView';
import { useVideoPlayer } from 'expo-video/build/VideoPlayer';
import type {
  PlayingChangeEventPayload,
  StatusChangeEventPayload,
  TimeUpdateEventPayload,
} from 'expo-video/build/VideoPlayerEvents.types';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import {
  ElementRef,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Stack, View, XStack, YStack, ZStack, isWeb } from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MediaViewer'>;

const logger = createDevLogger('imageViewer', false);

function MediaViewerModal({
  dismiss,
  children,
}: PropsWithChildren<{
  dismiss?: () => void;
}>) {
  if (isWeb) {
    return <Modal animationType="none" onRequestClose={dismiss}>{children}</Modal>;
  }

  return <>{children}</>;
}

function OverlayIconButton({ icon }: { icon: 'Close' | 'ArrowDown' }) {
  return (
    <Stack padding="$m" backgroundColor="$darkOverlay" borderRadius="$l">
      <Icon type={icon} size="$l" color="$white" />
    </Stack>
  );
}

function VideoLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <View
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      justifyContent="center"
      alignItems="center"
      pointerEvents="none"
    >
      <Spinner size="large" color="$white" />
    </View>
  );
}

function VideoViewer({
  uri,
  posterUri,
  goBack,
}: {
  uri?: string;
  posterUri?: string;
  goBack: () => void;
}) {
  const { top } = useSafeAreaInsets();
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(!!uri);
  const [isReady, setIsReady] = useState(!posterUri);
  const videoSource = useMemo(
    () => (uri ? { uri } : null),
    [uri]
  );
  const player = useVideoPlayer(isWeb ? null : videoSource);
  const hasStartedPlaybackRef = useRef(false);
  const hasTrackedPlaybackStartRef = useRef(false);

  useEffect(() => {
    setShowOverlay(true);
    setIsBuffering(!!uri);
    setIsReady(!posterUri);
    hasStartedPlaybackRef.current = false;
    hasTrackedPlaybackStartRef.current = false;
  }, [uri, posterUri]);

  const trackPlaybackStarted = useCallback(() => {
    if (hasTrackedPlaybackStartRef.current) {
      return;
    }
    hasTrackedPlaybackStartRef.current = true;
    logger.trackEvent(AnalyticsEvent.VideoPlaybackStarted, { src: uri });
  }, [uri]);

  useEffect(() => {
    if (isWeb) {
      return;
    }
    if (Platform.OS === 'ios') {
      player.bufferOptions = {
        waitsToMinimizeStalling: false,
        preferredForwardBufferDuration: 1,
      };
    }
    player.timeUpdateEventInterval = 0.25;
    if (uri) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, uri]);

  useEffect(() => {
    if (isWeb || !uri) {
      return;
    }

    const statusSubscription = player.addListener(
      'statusChange',
      ({ status, error }: StatusChangeEventPayload) => {
        if (status === 'error') {
          setIsReady(true);
          setIsBuffering(false);
          logger.trackEvent(AnalyticsEvent.VideoPlaybackError, {
            src: uri,
            error,
          });
          return;
        }

        if (status === 'readyToPlay' && !player.playing) {
          player.play();
        }

        const isNowBuffering = status === 'loading';
        setIsBuffering(isNowBuffering || !hasStartedPlaybackRef.current);
      }
    );

    const playingSubscription = player.addListener(
      'playingChange',
      ({ isPlaying }: PlayingChangeEventPayload) => {
        if (!isPlaying) {
          return;
        }
        trackPlaybackStarted();
      }
    );

    const timeUpdateSubscription = player.addListener(
      'timeUpdate',
      ({ currentTime }: TimeUpdateEventPayload) => {
        if (currentTime <= 0) {
          return;
        }
        hasStartedPlaybackRef.current = true;
        setIsReady(true);
        setIsBuffering(false);
      }
    );

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
      timeUpdateSubscription.remove();
    };
  }, [player, uri, trackPlaybackStarted]);

  const handlePlaybackError = useCallback(
    (error: unknown) => {
      setIsReady(true);
      setIsBuffering(false);
      logger.trackEvent(AnalyticsEvent.VideoPlaybackError, {
        src: uri,
        error,
      });
    },
    [uri]
  );
  const toggleOverlay = useCallback(() => {
    setShowOverlay((previous) => !previous);
  }, []);

  if (isWeb) {
    return (
      <MediaViewerModal dismiss={goBack}>
        <View
          flex={1}
          width="100%"
          height="100%"
          position="relative"
          backgroundColor="$black"
        >
          <Pressable
            onPress={goBack}
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
          />
          <View
            flex={1}
            width="100%"
            alignItems="center"
            justifyContent="center"
            padding="$l"
            pointerEvents="box-none"
          >
            {!uri ? (
              <Text color="$white">Unable to load video.</Text>
            ) : (
              <video
                src={uri}
                poster={posterUri}
                controls
                autoPlay
                preload="metadata"
                onPlay={trackPlaybackStarted}
                onLoadedData={() => {
                  setIsReady(true);
                  setIsBuffering(false);
                }}
                onCanPlay={() => {
                  setIsReady(true);
                  setIsBuffering(false);
                }}
                onWaiting={() => {
                  setIsBuffering(true);
                }}
                onPlaying={() => {
                  setIsReady(true);
                  setIsBuffering(false);
                  trackPlaybackStarted();
                }}
                onError={handlePlaybackError}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleOverlay();
                }}
                style={{
                  width: '100%',
                  maxWidth: 1100,
                  maxHeight: '90vh',
                  display: 'block',
                }}
              />
            )}
          </View>
          <VideoLoadingOverlay visible={!!uri && (!isReady || isBuffering)} />

          {showOverlay ? (
            <Pressable
              onPress={goBack}
              position="absolute"
              top={16}
              right="$xl"
            >
              <OverlayIconButton icon="Close" />
            </Pressable>
          ) : null}
        </View>
      </MediaViewerModal>
    );
  }

  return (
    <ZStack flex={1} backgroundColor="$black">
      <View
        flex={1}
        width="100%"
        alignItems="center"
        justifyContent="center"
        padding="$l"
      >
        {!uri ? (
          <Text color="$white">Unable to load video.</Text>
        ) : (
          <ZStack width="100%" height="100%">
            <VideoView
              player={player}
              nativeControls
              contentFit="contain"
              style={{
                width: '100%',
                height: '100%',
              }}
            />
            {posterUri && !isReady ? (
              <Image
                source={{ uri: posterUri }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                }}
                contentFit="contain"
              />
            ) : null}
          </ZStack>
        )}
      </View>
      <VideoLoadingOverlay visible={!!uri && (!isReady || isBuffering)} />

      {showOverlay ? (
        <Pressable
          onPress={goBack}
          position="absolute"
          top={top}
          right="$xl"
        >
          <OverlayIconButton icon="Close" />
        </Pressable>
      ) : null}
    </ZStack>
  );
}

function ImageViewer(props: { uri?: string; goBack: () => void }) {
  const zoomableRef = useRef<ElementRef<typeof Zoomable>>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [maxPanPointers, setMaxPanPointers] = useState(2);
  const { top } = useSafeAreaInsets();

  // We can't observe the zoom on `react-native-image-zoom`, so we have to
  // track it manually.
  // Call `setIsAtMinZoom` whenever you think user switches between zoomed all
  // the way out / zoomed in by some amount.
  const [isAtMinZoom, setIsAtMinZoom] = useState(true);

  function onSingleTap() {
    setShowOverlay(!showOverlay);
  }

  function handlePinchEnd(event: { scale: number }) {
    setIsAtMinZoom(event.scale <= 1);
    if (event.scale > 1) {
      setMaxPanPointers(1);
    } else {
      setMaxPanPointers(2);
      triggerHaptic('zoomable');
    }
  }

  function onDoubleTap(doubleTapType: string) {
    if (doubleTapType === 'ZOOM_IN') {
      setMaxPanPointers(1);
    } else {
      setMaxPanPointers(2);
      zoomableRef.current?.reset();
      setIsAtMinZoom(true);
      triggerHaptic('zoomable');
    }
  }

  const handleDownloadImage = async () => {
    if (isWeb) {
      if (!props.uri) {
        return;
      }

      try {
        await downloadImageForWeb(props.uri);
      } catch (error) {
        logger.trackError('Download error:', error);
        console.error('Download error:', error);
      }
    } else {
      try {
        const { status, canAskAgain } =
          await MediaLibrary.requestPermissionsAsync();
        let permissionStatus;

        switch (status) {
          case MediaLibrary.PermissionStatus.GRANTED:
            break;
          case MediaLibrary.PermissionStatus.DENIED:
            if (canAskAgain) {
              logger.trackError('Photo library permission denied (temporary)', {
                canAskAgain: true,
              });
              Alert.alert(
                'Permission needed',
                'Tlon needs permission to save images to your photo library. Would you like to grant permission now?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Grant Permission',
                    onPress: async () => {
                      const { status: retryStatus } =
                        await MediaLibrary.requestPermissionsAsync();
                      if (
                        retryStatus !== MediaLibrary.PermissionStatus.GRANTED
                      ) {
                        logger.trackError(
                          'Photo library permission denied after retry',
                          { canAskAgain: true }
                        );
                        Alert.alert(
                          'Permission denied',
                          'To save images, please enable photo library access in your device settings.'
                        );
                      }
                    },
                  },
                ]
              );
              return;
            } else {
              logger.trackError('Photo library permission denied (permanent)', {
                canAskAgain: false,
              });
              Alert.alert(
                'Permission required',
                'To save images, please enable photo library access in your device settings.',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Open Settings',
                    onPress: () => {
                      if (Platform.OS === 'ios') {
                        Linking.openURL('app-settings:');
                      } else {
                        Linking.openSettings();
                      }
                    },
                  },
                ]
              );
              return;
            }
          case MediaLibrary.PermissionStatus.UNDETERMINED: {
            const result = await MediaLibrary.requestPermissionsAsync();
            permissionStatus = result.status;
            if (permissionStatus !== MediaLibrary.PermissionStatus.GRANTED) {
              logger.trackError(
                'Photo library permission denied on first request',
                { canAskAgain: true }
              );
              Alert.alert(
                'Permission needed',
                'Tlon needs permission to save images to your photo library. Please grant permission in the next prompt.'
              );
              return;
            }
            break;
          }
        }

        if (!props.uri) {
          logger.trackError('Attempted to save image with no URI', {
            hasUri: false,
          });
          Alert.alert('Error', 'No image URL provided');
          return;
        }

        const baseFilename =
          props.uri.split('/').pop()?.split('?')[0] || 'downloaded-image';
        const filename = ensureFileExtension(baseFilename);
        const localUri = `${FileSystem.documentDirectory}${filename}`;

        try {
          const downloadResult = await FileSystem.downloadAsync(
            props.uri, 
            localUri
          );

          if (downloadResult.status !== 200) {
            logger.trackError('Failed to download image', {
              status: downloadResult.status,
              uri: props.uri,
            });
            throw new Error(
              `Download failed with status ${downloadResult.status}`
            );
          }

          const fileInfo = await FileSystem.getInfoAsync(localUri);
          if (!fileInfo.exists) {
            logger.trackError('Downloaded file does not exist', {
              uri: props.uri,
              localUri,
            });
            throw new Error('Downloaded file does not exist');
          }

          try {
            const fileUri = localUri.startsWith('file://')
              ? localUri
              : `file://${localUri}`;
            await MediaLibrary.saveToLibraryAsync(fileUri);
            Alert.alert('Success', 'Image saved to your photos!');
          } catch (saveError) {
            logger.trackError('Failed to save image to library', {
              error: saveError.message,
              uri: props.uri,
              localUri,
            });

            Alert.alert(
              'Error',
              'Failed to save image to photos. Please check your device storage and try again.'
            );
            console.error('Save error:', saveError);
          } finally {
            try {
              // Check if file still exists before attempting to delete
              const fileStillExists = await FileSystem.getInfoAsync(localUri);
              if (fileStillExists.exists) {
                await FileSystem.deleteAsync(localUri);
              }
            } catch (deleteError) {
              // Silently ignore deletion errors - file may have been moved by MediaLibrary
              logger.trackError('Failed to delete temporary image file', {
                error: deleteError.message,
                uri: localUri,
              });
            }
          }
        } catch (downloadError) {
          logger.trackError('Failed to download image', {
            error: downloadError.message,
            uri: props.uri,
          });
          Alert.alert(
            'Error',
            'Failed to download image. Please check your internet connection and try again.'
          );
          console.error('Download error:', downloadError);
        }
      } catch (error) {
        logger.trackError('Unexpected error saving image', {
          error: error.message,
          uri: props.uri,
        });
        Alert.alert(
          'Error',
          'An unexpected error occurred while saving the image. Please try again.'
        );
        console.error('Unexpected error:', error);
      }
    }
  };

  return (
    <ImageViewerContainer
      dismiss={props.goBack}
      dismissGestureEnabled={isAtMinZoom}
    >
      <ZStack
        flex={1}
        backgroundColor="$black"
        paddingTop={top}
        data-testid="image-viewer"
      >
        <View flex={1}>
          {isWeb ? (
            <View
              flex={1}
              height="100%"
              alignItems="center"
              justifyContent="center"
            >
              <Image
                source={{
                  uri: props.uri,
                }}
                data-testid="image"
                style={{
                  width: '100%',
                  height: 'auto',
                  aspectRatio:
                    Dimensions.get('window').width /
                    (Dimensions.get('window').height - top),
                }}
                contentFit="contain"
              />
            </View>
          ) : (
            <ImageZoom
              ref={zoomableRef}
              uri={props.uri}
              style={{ flex: 1 }}
              isDoubleTapEnabled
              isSingleTapEnabled
              isPanEnabled
              width={Dimensions.get('window').width}
              maxPanPointers={maxPanPointers}
              minScale={0.1}
              onPinchEnd={handlePinchEnd}
              onDoubleTap={onDoubleTap}
              onSingleTap={onSingleTap}
            />
          )}
        </View>

        {/* overlay */}
        {showOverlay ? (
          <YStack
            position="absolute"
            width="100%"
            padding="$xl"
            paddingTop={isWeb ? 16 : top}
          >
            <XStack
              justifyContent={isWeb ? 'flex-end' : 'space-between'}
              gap="$m"
            >
              <TouchableOpacity
                onPress={handleDownloadImage}
                activeOpacity={0.8}
              >
                <Stack
                  padding="$m"
                  backgroundColor="$darkOverlay"
                  borderRadius="$l"
                >
                  <Icon type="ArrowDown" size="$l" color="$white" />
                </Stack>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => props.goBack()}
                activeOpacity={0.8}
              >
                <Stack
                  padding="$m"
                  backgroundColor="$darkOverlay"
                  borderRadius="$l"
                >
                  <Icon type="Close" size="$l" color="$white" />
                </Stack>
              </TouchableOpacity>
            </XStack>
          </YStack>
        ) : null}
      </ZStack>
    </ImageViewerContainer>
  );
}

function ImageViewerContainer({
  dismiss,
  dismissGestureEnabled,
  children,
}: PropsWithChildren<{
  dismissGestureEnabled: boolean;
  dismiss?: () => void;
}>) {
  const dismissGesture = useMemo(
    () =>
      Gesture.Fling()
        .enabled(dismiss != null && dismissGestureEnabled && !isWeb)
        .direction(Directions.DOWN)
        .onEnd((_event, success) => {
          if (success && dismiss != null) {
            runOnJS(dismiss)();
          }
        }),
    [dismiss, dismissGestureEnabled]
  );

  // on web, we wrap in a modal to escape the drawer navigators
  if (isWeb) {
    return (
      <Modal animationType="none" onRequestClose={dismiss}>
        {children}
      </Modal>
    );
  }

  if (!dismissGesture) {
    console.error('ImageViewerContainer requires a dismissGesture on mobile');
    return null;
  }

  return <GestureDetector gesture={dismissGesture}>{children}</GestureDetector>;
}

export default function MediaViewerScreen(props: Props) {
  const { mediaType, uri, posterUri } = props.route.params;
  const goBack = useCallback(() => {
    props.navigation.pop();
  }, [props.navigation]);

  if (mediaType === 'video') {
    return <VideoViewer uri={uri} posterUri={posterUri} goBack={goBack} />;
  }

  return <ImageViewer uri={uri} goBack={goBack} />;
}
