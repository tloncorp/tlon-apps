import { Story } from '@tloncorp/shared/urbit';
import { Icon } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, View, XStack } from 'tamagui';

import { DraftInputContext } from './shared';

export function ColorInput({
  draftInputContext,
}: {
  draftInputContext: DraftInputContext;
}) {
  const [workingColor, setWorkingColor] = useState<string>('#000');

  const send = useCallback(async () => {
    try {
      await draftInputContext.sendPost(
        colorPost(workingColor),
        draftInputContext.channel.id
      );
    } catch (err) {
      console.error('failed upload', err);
    }
  }, [draftInputContext, workingColor]);

  const layoutSize = useSharedValue({
    width: 0,
    height: 0,
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      layoutSize.value = {
        width: e.nativeEvent.layout.width,
        height: e.nativeEvent.layout.height,
      };
    },
    [layoutSize]
  );

  const pan = Gesture.Pan()
    .minDistance(1)
    .onUpdate((event) => {
      const xProgress = event.x / layoutSize.value.width;
      const yProgress = event.y / layoutSize.value.height;
      runOnJS(setWorkingColor)(
        `hsl(${xProgress * 360}, 50%, ${yProgress * 100}%)`
      );
    });

  return (
    <SafeAreaView edges={['right', 'left', 'bottom']}>
      <XStack gap="$m" padding="$m" alignItems="flex-end">
        <View flex={1}>
          <GestureDetector gesture={pan}>
            <View
              onLayout={handleLayout}
              width={'100%'}
              height={140}
              borderRadius={'$m'}
              backgroundColor={workingColor}
            />
          </GestureDetector>
        </View>

        <Button marginBottom="$xs" onPress={send} borderColor="transparent">
          <Icon size="$m" type="ArrowUp" />
        </Button>
      </XStack>
    </SafeAreaView>
  );
}

function colorPost(color: string): Story {
  return [
    {
      inline: [color],
    },
  ];
}
