import { useMutableRef } from '@tloncorp/shared';
import { Carousel, CarouselRef, FilePreview, Text } from '@tloncorp/ui';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { YStack } from 'tamagui';

import { useRetainedBucketPages } from './useRetainedBucketPages';
import { BucketFileNavigation } from './BucketFileViewer.shared';

export function BucketFilePager({
  children,
  navigation,
  retainActivePage = false,
}: {
  children: ReactNode;
  navigation?: BucketFileNavigation;
  retainActivePage?: boolean;
}) {
  const carousel = useRef<CarouselRef>(null);
  const retained = useRetainedBucketPages(
    children,
    navigation,
    retainActivePage
  );
  const navigationRef = useMutableRef(navigation);
  const reducedMotion = useReducedMotion();
  const visibleIndex = useRef(navigation?.index ?? 0);
  const requestedIndex = useRef<number | null>(null);
  const selectedIndex = navigation?.index;
  const selectedItem = navigation?.items[selectedIndex ?? -1];
  const selectedKey = selectedItem?.id ?? selectedItem?.name;
  const previousSelectedKey = useRef(selectedKey);
  const onVisibleIndexChange = useCallback(
    (index: number) => {
      visibleIndex.current = index;
      // Intermediate pages in an arrow transition must not undo its selection.
      if (requestedIndex.current !== null) {
        if (index !== requestedIndex.current) return;
        requestedIndex.current = null;
      }
      const current = navigationRef.current;
      if (current && index !== current.index && current.items[index])
        current.onSelect(index);
    },
    [navigationRef]
  );
  const onScrollBeginDrag = useCallback(() => {
    requestedIndex.current = null;
    onVisibleIndexChange(visibleIndex.current);
  }, [onVisibleIndexChange]);

  useEffect(() => {
    const previousKey = previousSelectedKey.current;
    previousSelectedKey.current = selectedKey;
    if (
      selectedIndex === undefined ||
      selectedIndex < 0 ||
      selectedKey === undefined
    ) {
      requestedIndex.current = null;
      return;
    }
    if (
      visibleIndex.current === selectedIndex &&
      requestedIndex.current === null
    )
      return;
    requestedIndex.current = selectedIndex;
    // Reordering siblings should keep the same document in place immediately.
    carousel.current?.scrollToIndex(
      selectedIndex,
      !reducedMotion && previousKey !== selectedKey
    );
  }, [selectedIndex, selectedKey, reducedMotion]);

  if (!navigation || navigation.items.length === 0 || navigation.index < 0)
    return children;
  return (
    <Carousel
      ref={carousel}
      width="100%"
      flex={1}
      backgroundColor="$secondaryBackground"
      hideOverlayOnTap={false}
      initialVisibleIndex={navigation.index}
      onVisibleIndexChange={onVisibleIndexChange}
      flatListProps={{
        showsHorizontalScrollIndicator: false,
        bounces: false,
        onScrollBeginDrag,
        onMomentumScrollEnd: ({ nativeEvent }) => {
          const index = Math.round(
            nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width
          );
          // A rapid reversal can finish without another visible-index change.
          if (index === requestedIndex.current) onVisibleIndexChange(index);
        },
      }}
    >
      {navigation.items.map((item, index) => (
        <Carousel.Item
          key={item.id ?? item.name}
          flex={1}
          backgroundColor="$secondaryBackground"
        >
          {index === navigation.index ? (
            children
          ) : retained.has(item.id ?? item.name) ? (
            retained.get(item.id ?? item.name)!.node
          ) : (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              gap="$l"
              padding="$2xl"
            >
              <FilePreview
                size="m"
                fileExtensionLabel={
                  FilePreview.fileExtensionFrom({
                    filename: item.name,
                    mimeType: item.mimeType,
                  }) ?? undefined
                }
              />
              <Text size="$label/m" color="$secondaryText" textAlign="center">
                {item.name}
              </Text>
            </YStack>
          )}
        </Carousel.Item>
      ))}
    </Carousel>
  );
}
