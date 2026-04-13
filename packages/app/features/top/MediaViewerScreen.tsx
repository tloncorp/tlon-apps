import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  createDevLogger,
  downloadImageForWeb,
  ensureFileExtension,
} from '@tloncorp/shared';
import { GestureMediaViewer, Icon, Image, Pressable } from '@tloncorp/ui';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';
import type {
  PlayingChangeEventPayload,
  StatusChangeEventPayload,
  TimeUpdateEventPayload,
} from 'expo-video';
import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AnimatePresence,
  Spinner,
  Stack,
  View,
  XStack,
  YStack,
  ZStack,
  isWeb,
} from 'tamagui';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MediaViewer'>;

const logger = createDevLogger('imageViewer', false);
const GESTURE_VIEWER_ANIMATION_DURATION = 300;

function MediaViewerModal({
  dismiss,
  children,
}: PropsWithChildren<{
  dismiss?: () => void;
}>) {
  if (isWeb) {
    // On web, wrap in a modal so the lightbox can escape the drawer navigators.
    return (
      <Modal animationType="none" onRequestClose={dismiss}>
        {children}
      </Modal>
    );
  }

  return <>{children}</>;
}

function OverlayIconButton({ icon }: { icon: 'Close' | 'ArrowDown' }) {
  return (
    <View padding="$m" backgroundColor="$darkOverlay" borderRadius="$l">
      <Icon type={icon} size="$l" color="$white" />
    </View>
  );
}

function ImageViewerContainer({
  dismiss,
  children,
}: PropsWithChildren<{
  dismiss?: () => void;
}>) {
  return <MediaViewerModal dismiss={dismiss}>{children}</MediaViewerModal>;
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
  viewerId,
  goBack,
}: {
  uri: string;
  posterUri?: string;
  viewerId?: string;
  goBack: () => void;
}) {
  const { top } = useSafeAreaInsets();
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isReady, setIsReady] = useState(!posterUri);
  const [isTransitioning, setIsTransitioning] = useState(!isWeb);
  const items = useMemo(
    () => [{ type: 'video' as const, uri, posterUri }],
    [posterUri, uri]
  );
  const videoSource = useMemo(() => ({ uri }), [uri]);
  const player = useVideoPlayer(isWeb ? null : videoSource);
  const hasStartedPlaybackRef = useRef(false);
  const hasTrackedPlaybackStartRef = useRef(false);

  useEffect(() => {
    setShowOverlay(true);
    setIsBuffering(true);
    setIsReady(!posterUri);
    setIsTransitioning(!isWeb);
    hasStartedPlaybackRef.current = false;
    hasTrackedPlaybackStartRef.current = false;
  }, [uri, posterUri]);

  // Keep the loading overlay hidden while the native trigger animation plays.
  useEffect(() => {
    if (isWeb) {
      setIsTransitioning(false);
      return;
    }

    const timeout = setTimeout(() => {
      setIsTransitioning(false);
    }, GESTURE_VIEWER_ANIMATION_DURATION);

    return () => {
      clearTimeout(timeout);
    };
  }, [uri]);

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
    player.play();
  }, [player, uri]);

  useEffect(() => {
    if (isWeb) {
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
  const hideOverlayAndLoading = useCallback(() => {
    setShowOverlay(false);
    setIsReady(true);
    setIsBuffering(false);
    setIsTransitioning(true);
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
          </View>
          <VideoLoadingOverlay
            visible={!isTransitioning && (!isReady || isBuffering)}
          />

          {showOverlay ? (
            <Pressable
              onPress={goBack}
              position="absolute"
              top={16}
              right="$xl"
              testID="MediaViewerCloseButton"
            >
              <OverlayIconButton icon="Close" />
            </Pressable>
          ) : null}
        </View>
      </MediaViewerModal>
    );
  }

  return (
    <GestureMediaViewer
      id={viewerId}
      items={items}
      onDismiss={goBack}
      onDismissStart={hideOverlayAndLoading}
      enableDismissGesture={!isWeb}
      enableSwipeGesture={false}
      enableZoomGesture={false}
      enableDoubleTapGesture={false}
      enableZoomPanGesture={false}
      renderItem={() => (
        <View
          flex={1}
          width="100%"
          alignItems="center"
          justifyContent="center"
          padding="$l"
        >
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
        </View>
      )}
      renderContainer={(children, helpers) => {
        const dismiss = () => {
          hideOverlayAndLoading();
          helpers.dismiss();
        };

        return (
          <ZStack flex={1} data-testid="video-viewer">
            {children}
            <VideoLoadingOverlay
              visible={!isTransitioning && (!isReady || isBuffering)}
            />

            {showOverlay ? (
              <Pressable
                onPress={dismiss}
                position="absolute"
                top={top}
                right="$xl"
              >
                <OverlayIconButton icon="Close" />
              </Pressable>
            ) : null}
          </ZStack>
        );
      }}
    />
  );
}

function ImageViewer(props: {
  uri: string;
  viewerId?: string;
  goBack: () => void;
}) {
  const [showOverlay, setShowOverlay] = useState(true);
  const { top } = useSafeAreaInsets();
  const toggleOverlay = useCallback(() => {
    setShowOverlay((previous) => !previous);
  }, []);
  const items = useMemo(
    () => [{ type: 'image' as const, uri: props.uri }],
    [props.uri]
  );

  useEffect(() => {
    setShowOverlay(true);
  }, [props.uri]);

  const handleDownloadImage = async () => {
    if (isWeb) {
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
    <GestureMediaViewer
      id={props.viewerId}
      items={items}
      onDismiss={props.goBack}
      onDismissStart={() => {
        setShowOverlay(false);
      }}
      onSingleTap={toggleOverlay}
      enableSwipeGesture={false}
      enableDismissGesture={!isWeb}
      renderContainer={(children, helpers) => {
        const dismiss = () => {
          setShowOverlay(false);
          helpers.dismiss();
        };

        return (
          <ImageViewerContainer dismiss={helpers.dismiss}>
            <ZStack
              flex={1}
              backgroundColor={isWeb ? '$black' : undefined}
              paddingTop={isWeb ? top : undefined}
              data-testid="image-viewer"
            >
              <View flex={1}>{children}</View>

              <AnimatePresence>
                {showOverlay ? (
                  <YStack
                    key="overlay"
                    animation="simple"
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
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
                        <OverlayIconButton icon="ArrowDown" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={dismiss}
                        activeOpacity={0.8}
                        testID="MediaViewerCloseButton"
                      >
                        <OverlayIconButton icon="Close" />
                      </TouchableOpacity>
                    </XStack>
                  </YStack>
                ) : null}
              </AnimatePresence>
            </ZStack>
          </ImageViewerContainer>
        );
      }}
    />
  );
}

export default function MediaViewerScreen(props: Props) {
  const { mediaType, uri, posterUri, viewerId } = props.route.params;
  const goBack = useCallback(() => {
    props.navigation.pop();
  }, [props.navigation]);
  // We should never hit this in practice, but the shared navigation types
  // still allow `MediaViewer` to be opened without a uri.
  const missingUri = !uri;

  useEffect(() => {
    if (!missingUri) {
      return;
    }

    logger.trackError('Media viewer opened without a uri', {
      mediaType,
      viewerId,
    });
    goBack();
  }, [goBack, mediaType, missingUri, viewerId]);

  if (missingUri) {
    return null;
  }

  if (mediaType === 'video') {
    return (
      <VideoViewer
        uri={uri}
        posterUri={posterUri}
        viewerId={viewerId}
        goBack={goBack}
      />
    );
  }

  return <ImageViewer uri={uri} viewerId={viewerId} goBack={goBack} />;
}
