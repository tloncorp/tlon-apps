import { ImageZoom, Zoomable } from '@likashefqet/react-native-image-zoom';
import { Icon } from '@tloncorp/ui';
import { Image } from '@tloncorp/ui';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { ElementRef, PropsWithChildren, useRef, useState } from 'react';
import { Alert, Dimensions, Modal, TouchableOpacity } from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, View, XStack, YStack, ZStack, isWeb } from 'tamagui';

import { triggerHaptic } from '../utils';

export function ImageViewerScreenView(props: {
  uri?: string;
  goBack: () => void;
}) {
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

  const dismissGesture = Gesture.Fling()
    .enabled(isAtMinZoom)
    .direction(Directions.DOWN)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(props.goBack)();
      }
    });

  const handleDownloadImage = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Please grant Tlon permission to save images'
        );
        return;
      }

      const filename = props.uri?.split('/').pop() || 'downloaded-image.jpg';
      const localUri = `${FileSystem.documentDirectory}${filename}`;
      const downloadResult = await FileSystem.downloadAsync(
        props.uri!,
        localUri
      );

      if (downloadResult.status === 200) {
        await MediaLibrary.saveToLibraryAsync(localUri);
        await FileSystem.deleteAsync(localUri);

        Alert.alert('Success', 'Image saved to your photos!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save image');
      console.error('Download error:', error);
    }
  };

  return (
    <ImageViewerContainer>
      <GestureDetector gesture={dismissGesture}>
        <ZStack
          flex={1}
          backgroundColor="$black"
          paddingTop={top}
          data-testid="image-viewer"
        >
          <View flex={1}>
            {isWeb ? (
              <Zoomable
                ref={zoomableRef}
                data-testid="zoomable-image"
                style={{
                  flex: 1,
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                isDoubleTapEnabled
                isSingleTapEnabled
                isPanEnabled
                minScale={0.1}
                onPinchEnd={handlePinchEnd}
                onDoubleTap={onDoubleTap}
                onSingleTap={onSingleTap}
                maxPanPointers={maxPanPointers}
              >
                <Image
                  source={{
                    uri: props.uri,
                  }}
                  data-testid="image"
                  style={{
                    height: 'auto',
                    maxWidth: Dimensions.get('window').width,
                    maxHeight: Dimensions.get('window').height - top,
                  }}
                />
              </Zoomable>
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
      </GestureDetector>
    </ImageViewerContainer>
  );
}

function ImageViewerContainer(props: PropsWithChildren) {
  // on web, we wrap in a modal to escape the drawer navigators
  if (isWeb) {
    return <Modal animationType="none">{props.children}</Modal>;
  }

  return props.children;
}
