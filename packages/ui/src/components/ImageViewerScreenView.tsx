import { ImageZoom, Zoomable } from '@likashefqet/react-native-image-zoom';
import { ElementRef, useRef, useState } from 'react';
import { Dimensions, TouchableOpacity } from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, View, XStack, YStack, ZStack, isWeb } from 'tamagui';

import { triggerHaptic } from '../utils';
import { Icon } from './Icon';
import { Image } from './Image';

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

  return (
    <GestureDetector gesture={dismissGesture}>
      <ZStack flex={1} backgroundColor="$black" paddingTop={top}>
        <View flex={1} justifyContent="center" alignItems="center">
          {isWeb ? (
            <Zoomable
              ref={zoomableRef}
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
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
                source={{ uri: props.uri }}
                height={Dimensions.get('window').height}
                width={Dimensions.get('window').width - 20}
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
              width={Dimensions.get('window').width - 20}
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
          <YStack padding="$xl" paddingTop={top}>
            <XStack justifyContent="flex-end">
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
  );
}
