import { useMutableRef } from '@tloncorp/shared';
import { Carousel, CarouselRef, FilePreview, Text } from '@tloncorp/ui';
import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { YStack } from 'tamagui';

import { BucketFileNavigation } from './BucketFileViewer.shared';

export function BucketFilePager({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation?: BucketFileNavigation;
}) {
  const carousel = useRef<CarouselRef>(null);
  const navigationRef = useMutableRef(navigation);
  const visibleIndex = useRef(navigation?.index ?? 0);
  const onVisibleIndexChange = useCallback(
    (index: number) => {
      visibleIndex.current = index;
      const current = navigationRef.current;
      if (current && index !== current.index && current.items[index])
        current.onSelect(index);
    },
    [navigationRef]
  );

  useEffect(() => {
    if (!navigation || visibleIndex.current === navigation.index) return;
    visibleIndex.current = navigation.index;
    carousel.current?.scrollToIndex(navigation.index, false);
  }, [navigation]);

  if (!navigation || navigation.items.length < 2 || navigation.index < 0)
    return children;
  return (
    <Carousel
      key={navigation.items.map((item) => item.id ?? item.name).join('|')}
      ref={carousel}
      width="100%"
      flex={1}
      hideOverlayOnTap={false}
      initialVisibleIndex={navigation.index}
      onVisibleIndexChange={onVisibleIndexChange}
      flatListProps={{ showsHorizontalScrollIndicator: false, bounces: false }}
    >
      {navigation.items.map((item, index) => (
        <Carousel.Item key={item.id ?? item.name} flex={1}>
          {index === navigation.index ? (
            children
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
