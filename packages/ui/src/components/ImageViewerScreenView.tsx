import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as db from '@tloncorp/shared/db';
import * as Haptics from 'expo-haptics';
import { ElementRef, useRef, useState } from 'react';
import { Dimensions, TouchableOpacity } from 'react-native';
import {
  Directions,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, View, XStack, YStack, ZStack } from 'tamagui';

import { Icon } from './Icon';

export function ImageViewerScreenView(props: {
  post?: db.Post | null;
  uri?: string;
  goBack: () => void;
}) {
  const zoomableRef = useRef<ElementRef<typeof ImageZoom>>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [minPanPointers, setMinPanPointers] = useState(2);
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
      setMinPanPointers(1);
    } else {
      setMinPanPointers(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  function onDoubleTap(doubleTapType: string) {
    if (doubleTapType === 'ZOOM_IN') {
      setMinPanPointers(1);
    } else {
      setMinPanPointers(2);
      zoomableRef.current?.reset();
      setIsAtMinZoom(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          <ImageZoom
            ref={zoomableRef}
            style={{ flex: 1 }}
            width={Dimensions.get('window').width - 20}
            uri={props.uri}
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
