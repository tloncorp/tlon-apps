import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AnalyticsEvent,
  createDevLogger,
  downloadImageForWeb,
  ensureFileExtension,
} from '@tloncorp/shared';
import {
  GestureMediaViewer,
  Icon,
  Image,
  Pressable,
  Text,
  type GestureMediaViewerItem,
  type GestureMediaViewerRenderHelpers,
  type GestureMediaViewerRenderItem,
} from '@tloncorp/ui';
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
  PropsWithChildren,
  type ReactNode,
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

type ViewerOverlayAction = {
  icon: 'Close' | 'ArrowDown';
  onPress: () => void;
};

function ViewerOverlayActions({
  showOverlay,
  top,
  actions,
  justifyContent = 'space-between',
}: {
  showOverlay: boolean;
  top: number;
  actions: ViewerOverlayAction[];
  justifyContent?: 'space-between' | 'flex-end';
}) {
  if (!showOverlay) {
    return null;
  }

  return (
    <YStack
      position="absolute"
      width="100%"
      padding="$xl"
      paddingTop={isWeb ? 16 : top}
    >
      <XStack justifyContent={justifyContent} gap="$m">
        {actions.map((action, index) => (
          <TouchableOpacity
            key={`${action.icon}-${index}`}
            onPress={action.onPress}
            activeOpacity={0.8}
          >
            <OverlayIconButton icon={action.icon} />
          </TouchableOpacity>
        ))}
      </XStack>
    </YStack>
  );
}

function MediaViewerChrome({
  dismiss,
  testID,
  backgroundColor,
  onBackdropPress,
  top,
  showOverlay,
  actions,
  justifyContent = 'space-between',
  loadingOverlay,
  children,
}: PropsWithChildren<{
  dismiss?: () => void;
  testID: string;
  backgroundColor?: string;
  onBackdropPress?: () => void;
  top: number;
  showOverlay: boolean;
  actions: ViewerOverlayAction[];
  justifyContent?: 'space-between' | 'flex-end';
  loadingOverlay?: ReactNode;
}>) {
  return (
    <MediaViewerModal dismiss={dismiss}>
      <ZStack
        flex={1}
        data-testid={testID}
        {...(backgroundColor ? { backgroundColor } : {})}
      >
        {onBackdropPress ? (
          <Pressable
            onPress={onBackdropPress}
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
          />
        ) : null}
        {children}
        {loadingOverlay}
        <ViewerOverlayActions
          showOverlay={showOverlay}
          top={top}
          actions={actions}
          justifyContent={justifyContent}
        />
      </ZStack>
    </MediaViewerModal>
  );
}

function GestureViewerRoute({
  viewerId,
  items,
  testID,
  onDismiss,
  onDismissStart,
  renderItem,
  top,
  showOverlay,
  actions,
  justifyContent,
  loadingOverlay,
  enableDismissGesture,
  enableSwipeGesture,
  enableZoomGesture,
  enableDoubleTapGesture,
  enableZoomPanGesture,
}: {
  viewerId?: string;
  items: GestureMediaViewerItem[];
  testID: string;
  onDismiss: () => void;
  onDismissStart?: () => void;
  renderItem?: GestureMediaViewerRenderItem;
  top: number;
  showOverlay: boolean;
  actions: (
    helpers: GestureMediaViewerRenderHelpers
  ) => ViewerOverlayAction[];
  justifyContent?: 'space-between' | 'flex-end';
  loadingOverlay?: ReactNode;
  enableDismissGesture?: boolean;
  enableSwipeGesture?: boolean;
  enableZoomGesture?: boolean;
  enableDoubleTapGesture?: boolean;
  enableZoomPanGesture?: boolean;
}) {
  return (
    <GestureMediaViewer
      id={viewerId}
      items={items}
      onDismiss={onDismiss}
      onDismissStart={onDismissStart}
      renderItem={renderItem}
      enableDismissGesture={enableDismissGesture}
      enableSwipeGesture={enableSwipeGesture}
      enableZoomGesture={enableZoomGesture}
      enableDoubleTapGesture={enableDoubleTapGesture}
      enableZoomPanGesture={enableZoomPanGesture}
      renderContainer={(children, helpers) => (
        <MediaViewerChrome
          dismiss={helpers.dismiss}
          testID={testID}
          top={top}
          showOverlay={showOverlay}
          actions={actions(helpers)}
          justifyContent={justifyContent}
          loadingOverlay={loadingOverlay}
        >
          {children}
        </MediaViewerChrome>
      )}
    />
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
  viewerId,
  goBack,
}: {
  uri?: string;
  posterUri?: string;
  viewerId?: string;
  goBack: () => void;
}) {
  const { top } = useSafeAreaInsets();
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(!!uri);
  const [isReady, setIsReady] = useState(!posterUri);
  const items = useMemo(
    () =>
      uri
        ? [
            {
              type: 'video' as const,
              uri,
              posterUri,
            },
          ]
        : [],
    [posterUri, uri]
  );
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
      <MediaViewerChrome
        dismiss={goBack}
        testID="video-viewer"
        backgroundColor="$black"
        onBackdropPress={goBack}
        top={top}
        showOverlay={showOverlay}
        actions={[{ icon: 'Close', onPress: goBack }]}
        justifyContent="flex-end"
        loadingOverlay={
          <VideoLoadingOverlay visible={!!uri && (!isReady || isBuffering)} />
        }
      >
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
      </MediaViewerChrome>
    );
  }

  if (!uri) {
    return (
      <MediaViewerChrome
        dismiss={goBack}
        testID="video-viewer"
        backgroundColor="$black"
        top={top}
        showOverlay={showOverlay}
        actions={[{ icon: 'Close', onPress: goBack }]}
        justifyContent="flex-end"
      >
        <View flex={1} justifyContent="center" alignItems="center">
          <Text color="$white">Unable to load video.</Text>
        </View>
      </MediaViewerChrome>
    );
  }

  return (
    <GestureViewerRoute
      viewerId={viewerId}
      items={items}
      testID="video-viewer"
      onDismiss={goBack}
      onDismissStart={() => {
        setShowOverlay(false);
      }}
      enableDismissGesture={!isWeb}
      enableSwipeGesture={false}
      enableZoomGesture={false}
      enableDoubleTapGesture={false}
      enableZoomPanGesture={false}
      top={top}
      showOverlay={showOverlay}
      actions={(helpers) => [{ icon: 'Close', onPress: helpers.dismiss }]}
      justifyContent="flex-end"
      loadingOverlay={
        <VideoLoadingOverlay visible={!!uri && (!isReady || isBuffering)} />
      }
      renderItem={() =>
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
      }
    />
  );
}

function ImageViewer(props: {
  uri?: string;
  viewerId?: string;
  goBack: () => void;
}) {
  const [showOverlay, setShowOverlay] = useState(true);
  const { top } = useSafeAreaInsets();
  const items = useMemo(
    () =>
      props.uri
        ? [
            {
              type: 'image' as const,
              uri: props.uri,
            },
          ]
        : [],
    [props.uri]
  );

  useEffect(() => {
    setShowOverlay(true);
  }, [props.uri]);

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

  if (!props.uri) {
    return (
      <MediaViewerChrome
        dismiss={props.goBack}
        testID="image-viewer"
        backgroundColor="$black"
        top={top}
        showOverlay={showOverlay}
        actions={[{ icon: 'Close', onPress: props.goBack }]}
        justifyContent="flex-end"
      >
        <View flex={1} justifyContent="center" alignItems="center">
          <Text color="$white">Unable to load image.</Text>
        </View>
      </MediaViewerChrome>
    );
  }

  return (
    <GestureViewerRoute
      viewerId={props.viewerId}
      items={items}
      testID="image-viewer"
      onDismiss={props.goBack}
      onDismissStart={() => {
        setShowOverlay(false);
      }}
      enableSwipeGesture={false}
      enableDismissGesture={!isWeb}
      top={top}
      showOverlay={showOverlay}
      actions={(helpers) => [
        { icon: 'ArrowDown', onPress: handleDownloadImage },
        { icon: 'Close', onPress: helpers.dismiss },
      ]}
      justifyContent={isWeb ? 'flex-end' : 'space-between'}
    />
  );
}

export default function MediaViewerScreen(props: Props) {
  const { mediaType, uri, posterUri, viewerId } = props.route.params;
  const goBack = useCallback(() => {
    props.navigation.pop();
  }, [props.navigation]);

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
