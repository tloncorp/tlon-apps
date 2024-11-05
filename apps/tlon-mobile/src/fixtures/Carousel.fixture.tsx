import { Carousel, IconButton } from '@tloncorp/ui';
import { Close } from 'packages/ui/src/assets/icons';
import { useCallback, useState } from 'react';
import { useSelect, useValue } from 'react-cosmos/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

const colors = ['red', 'blue', 'green', 'yellow', 'purple'];

export default function CarouselFixture() {
  const [fullscreen] = useValue('Fullscreen', {
    defaultValue: true,
  });
  const [pageCount] = useValue('Number of pages', {
    defaultValue: 3,
  });
  const [direction] = useSelect('Direction', {
    defaultValue: 'vertical',
    options: ['horizontal', 'vertical'],
  });

  const uriForPage = useCallback(
    (i: number) => `https://picsum.photos/seed/${i}/400/400`,
    []
  );

  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View flex={1} {...(fullscreen ? null : { padding: 100 })}>
        <Carousel
          flex={1}
          scrollDirection={direction}
          onVisibleIndexChange={setVisibleIndex}
        >
          {Array(pageCount)
            .fill(undefined)
            .map((_, i) => uriForPage(i))
            .map((uri, i) => (
              <Carousel.Item
                key={i}
                overlay={
                  <Carousel.Overlay
                    header={
                      <SafeAreaView
                        edges={['top', 'right', 'left']}
                        style={{
                          padding: 40,
                          // backgroundColor: 'rgba(0, 0, 0, 0.5)',
                          backgroundColor: colors[i % colors.length],
                        }}
                      >
                        <Text>Header {i}</Text>
                      </SafeAreaView>
                    }
                    footer={
                      <SafeAreaView
                        edges={['bottom', 'right', 'left']}
                        style={{
                          padding: 40,
                          backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        <Text>{uri}</Text>
                      </SafeAreaView>
                    }
                  />
                }
              >
                <Carousel.ContentImage
                  uri={uri}
                  safeAreaEdges={fullscreen ? undefined : []}
                />
              </Carousel.Item>
            ))}
        </Carousel>
        <View position="absolute" top={60} right={40}>
          <Text>Showing index: {visibleIndex}</Text>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
