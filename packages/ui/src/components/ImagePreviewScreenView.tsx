import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, XStack, YStack, ZStack } from '../core';
import { Button } from './Button';

interface ImageZoomRef {
  reset: () => void;
}

export function ImagePreviewScreenView(props: {
  source: { uri: string };
  goBack: () => void;
}) {
  const zoomableRef = useRef<ImageZoomRef>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showZoomable, setShowZoomable] = useState(false);
  const [minPanPointers, setMinPanPointers] = useState(2);
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    setTimeout(() => setShowZoomable(true), 300);
  }, []);

  function onClose() {
    zoomableRef.current?.reset();
    setTimeout(() => {
      setShowZoomable(false);
      setTimeout(() => props.goBack());
    }, 10);
  }

  function onSingleTap() {
    console.log('single tap');
    setShowOverlay(!showOverlay);
  }

  function handlePinchEnd(event: { scale: number }) {
    if (event.scale > 1) {
      setMinPanPointers(1);
    } else {
      setMinPanPointers(2);
    }
  }

  function onDoubleTap(doubleTapType: string) {
    if (doubleTapType === 'ZOOM_IN') {
      setShowOverlay(false);
      setMinPanPointers(1);
    } else {
      setMinPanPointers(2);
      zoomableRef.current?.reset();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  return (
    <>
      <ZStack
        flex={1}
        backgroundColor="$black"
        justifyContent="center"
        paddingTop={top}
      >
        {/* <Animated.View sharedTransitionTag="blub">
          <ImageZoom
            style={{ flex: 1 }}
            uri={props.source.uri}
            width={Dimensions.get('window').width - 40}
          /> */}
        <ZStack flex={1}>
          <View
            opacity={showZoomable ? 1 : 0}
            flex={1}
            justifyContent="center"
            alignItems="center"
          >
            <ImageZoom
              ref={zoomableRef}
              style={{ flex: 1 }}
              uri={props.source.uri}
              width={Dimensions.get('window').width - 40}
              isDoubleTapEnabled
              isSingleTapEnabled
              isPanEnabled
              minScale={0.5}
              onPinchEnd={handlePinchEnd}
              onDoubleTap={onDoubleTap}
              onSingleTap={onSingleTap}
              minPanPointers={minPanPointers}
            />
          </View>
          {/* We duplicate the image here because the shared transition requires a fixed sized target. This layer
          is hidden after entrance and revealed before exit */}
          <View
            opacity={showZoomable ? 0 : 1}
            flex={1}
            justifyContent="center"
            alignItems="center"
            pointerEvents="none"
          >
            <Animated.Image
              sharedTransitionTag={props.source.uri}
              source={{
                uri: props.source.uri,
              }}
              style={{
                resizeMode: 'contain',
                padding: 0,
                width: Dimensions.get('window').width - 40,
                height: Dimensions.get('window').width - 40,
              }}
            />
          </View>
        </ZStack>
        <YStack>
          <XStack
            opacity={showOverlay ? 1 : 0}
            paddingTop={top}
            paddingBottom="$s"
            paddingRight="$m"
            backgroundColor="$secondaryBackground"
            justifyContent="flex-end"
          >
            <Button minimal onPress={onClose}>
              <Button.Text color="$positiveActionText" fontWeight="500">
                Done
              </Button.Text>
            </Button>
          </XStack>
        </YStack>
      </ZStack>
    </>
  );
}
