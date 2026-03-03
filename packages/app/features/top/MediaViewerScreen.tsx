import { ImageZoom, Zoomable } from '@likashefqet/react-native-image-zoom';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  createDevLogger,
  downloadImageForWeb,
  ensureFileExtension,
} from '@tloncorp/shared';
import { Icon, Image, Pressable, Text, triggerHaptic } from '@tloncorp/ui';
import {
  AVPlaybackStatus,
  ResizeMode,
  Video as ExpoVideo,
} from 'expo-av';
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

type Props = NativeStackScreenProps<RootStackParamList, 'MediaViewer'>;

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
      <Stack padding="$m" backgroundColor="$darkOverlay" borderRadius="$l">
        <Spinner size="large" color="$white" />
      </Stack>
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
  const [hasTrackedPlaybackStart, setHasTrackedPlaybackStart] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(!!uri);
  const [isReady, setIsReady] = useState(!posterUri);
  const source = useMemo(() => (uri ? { uri } : undefined), [uri]);

  useEffect(() => {
    setHasTrackedPlaybackStart(false);
    setShowOverlay(true);
    setIsBuffering(!!uri);
    setIsReady(!posterUri);
  }, [uri, posterUri]);

  const trackPlaybackStarted = useCallback(() => {
    if (hasTrackedPlaybackStart) {
      return;
    }
    logger.trackEvent(AnalyticsEvent.VideoPlaybackStarted, { src: uri });
    setHasTrackedPlaybackStart(true);
  }, [hasTrackedPlaybackStart, uri]);

  const handlePlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        setIsBuffering(true);
        return;
      }
      if (status.isPlaying) {
        trackPlaybackStarted();
      }
      setIsBuffering(status.isBuffering);
      if (status.positionMillis > 0 || status.isPlaying) {
        setIsReady(true);
      }
    },
    [trackPlaybackStarted]
  );

  const handlePlaybackError = useCallback(
    (error: unknown) => {
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
        <ZStack flex={1} backgroundColor="$black">
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
        </ZStack>
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
        onTouchEnd={toggleOverlay}
      >
        {!uri ? (
          <Text color="$white">Unable to load video.</Text>
        ) : (
          source && (
            <ExpoVideo
              source={source}
              usePoster={!!posterUri}
              posterSource={posterUri ? { uri: posterUri } : undefined}
              useNativeControls
              shouldPlay
              onReadyForDisplay={() => {
                setIsReady(true);
                setIsBuffering(false);
              }}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={handlePlaybackError}
              resizeMode={ResizeMode.CONTAIN}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          )
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
  const [isAtMinZoom, setIsAtMinZoom] = useState(true);
  const { top } = useSafeAreaInsets();

  function onSingleTap() {
    setShowOverlay((previous) => !previous);
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
      if (!uri) {
        return;
      }

      try {
        await downloadImageForWeb(uri);
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

        if (!uri) {
          logger.trackError('Attempted to save image with no URI', {
            hasUri: false,
          });
          Alert.alert('Error', 'No image URL provided');
          return;
        }

        const baseFilename =
          uri.split('/').pop()?.split('?')[0] || 'downloaded-image';
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
              uri,
            });
            throw new Error(
              `Download failed with status ${downloadResult.status}`
            );
          }

          const fileInfo = await FileSystem.getInfoAsync(localUri);
          if (!fileInfo.exists) {
            logger.trackError('Downloaded file does not exist', {
              uri,
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
              uri,
              localUri,
            });

            Alert.alert(
              'Error',
              'Failed to save image to photos. Please check your device storage and try again.'
            );
            console.error('Save error:', saveError);
          } finally {
            try {
              const fileStillExists = await FileSystem.getInfoAsync(localUri);
              if (fileStillExists.exists) {
                await FileSystem.deleteAsync(localUri);
              }
            } catch (deleteError) {
              logger.trackError('Failed to delete temporary image file', {
                error: deleteError.message,
                uri: localUri,
              });
            }
          }
        } catch (downloadError) {
          logger.trackError('Failed to download image', {
            error: downloadError.message,
            uri,
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
          uri,
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
    <ImageViewerContainer dismiss={goBack} dismissGestureEnabled={isAtMinZoom}>
      <ZStack flex={1} backgroundColor="$black" paddingTop={top} data-testid="image-viewer">
        <View flex={1}>
          {isWeb ? (
            <View
              flex={1}
              height="100%"
              alignItems="center"
              justifyContent="center"
            >
              <Image
                source={{ uri }}
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
              uri={uri}
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

        {showOverlay ? (
          <YStack
            position="absolute"
            width="100%"
            padding="$xl"
            paddingTop={isWeb ? 16 : top}
          >
            <XStack justifyContent={isWeb ? 'flex-end' : 'space-between'} gap="$m">
              <TouchableOpacity onPress={handleDownloadImage} activeOpacity={0.8}>
                <OverlayIconButton icon="ArrowDown" />
              </TouchableOpacity>

              <TouchableOpacity onPress={goBack} activeOpacity={0.8}>
                <OverlayIconButton icon="Close" />
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

  if (isWeb) {
    return <MediaViewerModal dismiss={dismiss}>{children}</MediaViewerModal>;
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
