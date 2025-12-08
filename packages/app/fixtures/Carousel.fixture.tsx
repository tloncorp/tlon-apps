import { range } from 'lodash';
import { useCallback, useRef, useState } from 'react';
import { useSelect, useValue } from 'react-cosmos/client';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

import { Button, Carousel } from '../ui';

const colors = ['red', 'blue', 'green', 'yellow', 'purple'];

export default function CarouselFixture() {
  const [fullscreen] = useValue('Fullscreen', {
    defaultValue: true,
  });
  const [direction] = useSelect('Direction', {
    defaultValue: 'vertical',
    options: ['horizontal', 'vertical'],
  });

  const uriForPage = useCallback(
    (i: number) => `https://picsum.photos/seed/s${i}/400/400`,
    []
  );

  const [pageSeeds, setPageSeeds] = useState(() => range(5));
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  const carouselRef = useRef<React.ElementRef<typeof Carousel>>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View flex={1} {...(fullscreen ? null : { padding: 100 })}>
        <Carousel
          ref={carouselRef}
          flex={1}
          scrollDirection={direction}
          onVisibleIndexChange={setVisibleIndex}
        >
          {pageSeeds
            .map((seed) => [seed, uriForPage(seed)] as const)
            .map(([seed, uri]) => (
              <Carousel.Item
                key={uri}
                overlay={
                  <Carousel.Overlay
                    header={
                      <SafeAreaView
                        edges={['top', 'right', 'left']}
                        style={{
                          padding: 40,
                          backgroundColor: colors[seed % colors.length],
                        }}
                      >
                        <Text>{seed}</Text>
                      </SafeAreaView>
                    }
                    footer={
                      <SafeAreaView
                        edges={['bottom', 'right', 'left']}
                        style={{
                          padding: 40,
                          backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
        <View position="absolute" top={60} right={20}>
          <Button
            fill="outline"
            type="primary"
            onPress={() => {
              Alert.prompt('Go to index', undefined, (input: string) => {
                try {
                  const n = parseInt(input);
                  if (n >= 0 && n < pageSeeds.length) {
                    carouselRef.current?.scrollToIndex(n);
                  } else {
                    throw null;
                  }
                } catch {
                  Alert.alert('Invalid index');
                }
              });
            }}
            label={`Showing index: ${visibleIndex}`}
          />
          <Button
            fill="outline"
            type="primary"
            onPress={() => {
              setPageSeeds((prev) => {
                const min = prev.length > 0 ? Math.min(...prev) : 0;
                return [...range(min - 1, min - 5, -1).reverse(), ...prev];
              });
            }}
            label="Load more at start"
          />
          <Button
            fill="outline"
            type="primary"
            onPress={() => {
              setPageSeeds((prev) => {
                const max = prev.length > 0 ? Math.max(...prev) : 0;
                return [...prev, ...range(max + 1, max + 5)];
              });
            }}
            label="Load more at end"
          />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
