import { ImageZoom } from '@likashefqet/react-native-image-zoom';
import * as db from '@tloncorp/shared/dist/db';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Dimensions, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, View, XStack, YStack, ZStack } from 'tamagui';

import { Close } from '../assets/icons';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

interface ImageZoomRef {
  reset: () => void;
}

export function ImageViewerScreenView(props: {
  post?: db.Post | null;
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
    </>
  );
}
