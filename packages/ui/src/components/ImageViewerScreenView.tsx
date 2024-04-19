import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as db from '@tloncorp/shared/dist/db';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { View, XStack, YStack, ZStack } from '../core';
import { Button } from './Button';

interface ImageZoomRef {
  reset: () => void;
}

export function ImageViewerScreenView(props: {
  post?: db.PostWithRelations;
  uri?: string;
  goBack: () => void;
}) {
  const zoomableRef = useRef<ImageZoomRef>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [minPanPointers, setMinPanPointers] = useState(2);
  const { top } = useSafeAreaInsets();

  function onSingleTap() {
    setShowOverlay(!showOverlay);
  }

  function handlePinchEnd(event: { scale: number }) {
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  return (
    <>
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
        <YStack>
          <XStack opacity={showOverlay ? 1 : 0}>
            <BlurView style={{ flex: 1 }} tint="extraLight" intensity={70}>
              <ZStack height={100}>
                <View flex={1} backgroundColor="$white" opacity={0.6} />
                <XStack
                  zIndex="$m"
                  paddingTop={top}
                  paddingBottom="$s"
                  paddingRight="$m"
                >
                  <XStack flex={1} justifyContent="flex-end">
                    <Button minimal onPress={() => props.goBack()}>
                      <Button.Text color="$positiveActionText" fontWeight="500">
                        Done
                      </Button.Text>
                    </Button>
                  </XStack>
                </XStack>
              </ZStack>
            </BlurView>
          </XStack>
        </YStack>
      </ZStack>
    </>
  );
}
