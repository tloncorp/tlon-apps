import { IconType, Text } from '@tloncorp/ui';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView as RNScrollView } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, View, XStack, YStack } from 'tamagui';

import { ActionSheet, ListItem, useIsWindowNarrow } from '../../ui';

export type GroupType = 'quick' | 'custom' | 'template';

const groupTemplates: Array<{
  id: string;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  {
    id: 'book-club',
    title: 'Book Club',
    subtitle: 'Discuss your latest reads',
    icon: '📚',
  },
  {
    id: 'hat-club',
    title: 'Hat Club',
    subtitle: 'Share your favorite hats',
    icon: '🎩',
  },
  {
    id: 'lobster-club',
    title: 'Lobster Club',
    subtitle: 'For lobster enthusiasts',
    icon: '🦞',
  },
];

interface GroupTypeCardProps {
  icon: IconType | string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const GroupTypeCard = ({
  icon,
  title,
  subtitle,
  onPress,
}: GroupTypeCardProps) => {
  const isEmoji = typeof icon === 'string' && icon.length <= 4;

  return (
    <Pressable onPress={onPress} style={{ cursor: 'pointer' }}>
      {({ pressed }) => (
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$l"
          padding="$l"
          height={134}
          backgroundColor={pressed ? '$secondaryBackground' : '$background'}
          justifyContent="space-between"
        >
          <YStack flex={1} justifyContent="flex-start">
            {isEmoji ? (
              <Text fontSize={32}>{icon}</Text>
            ) : (
              <ListItem.SystemIcon icon={icon as IconType} />
            )}
          </YStack>
          <ListItem.MainContent flex={0}>
            <ListItem.Title>{title}</ListItem.Title>
            <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
          </ListItem.MainContent>
        </YStack>
      )}
    </Pressable>
  );
};

interface CarouselArrowProps {
  direction: 'left' | 'right';
  onPress: () => void;
}

const CarouselArrow = ({ direction, onPress }: CarouselArrowProps) => {
  return (
    <View
      position="absolute"
      top="50%"
      zIndex={1}
      left={direction === 'left' ? 0 : undefined}
      right={direction === 'right' ? 0 : undefined}
      transform={[
        { translateY: '-50%' },
        { translateX: direction === 'left' ? '-50%' : '50%' },
      ]}
    >
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onPress();
        }}
        style={{ cursor: 'pointer' }}
      >
        <View
          width={28}
          height={28}
          borderRadius={14}
          borderWidth={1}
          borderColor="$secondaryBorder"
          backgroundColor="$background"
          justifyContent="center"
          alignItems="center"
        >
          <ListItem.SystemIcon
            icon={direction === 'left' ? 'ChevronLeft' : 'ChevronRight'}
            backgroundColor={'transparent'}
          />
        </View>
      </Pressable>
    </View>
  );
};

interface PaginationDotsProps {
  total: number;
  activeIndex: number;
}

const PaginationDots = ({ total, activeIndex }: PaginationDotsProps) => {
  const dotSpacing = 4;
  const inactiveDotSize = 4;
  const activeDotWidth = 10;

  return (
    <XStack
      justifyContent="center"
      alignItems="center"
      gap={dotSpacing}
      marginTop="$m"
      height={20}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === activeIndex;
        return (
          <PaginationDot
            key={index}
            isActive={isActive}
            inactiveSize={inactiveDotSize}
            activeWidth={activeDotWidth}
          />
        );
      })}
    </XStack>
  );
};

interface PaginationDotProps {
  isActive: boolean;
  inactiveSize: number;
  activeWidth: number;
}

const PaginationDot = ({
  isActive,
  inactiveSize,
  activeWidth,
}: PaginationDotProps) => {
  const width = useSharedValue(inactiveSize);
  const colorProgress = useSharedValue(0);

  if (isActive) {
    width.value = withSpring(activeWidth, {
      damping: 15,
      stiffness: 150,
    });
    colorProgress.value = withSpring(1, {
      damping: 15,
      stiffness: 150,
    });
  } else {
    width.value = withSpring(inactiveSize, {
      damping: 15,
      stiffness: 150,
    });
    colorProgress.value = withSpring(0, {
      damping: 15,
      stiffness: 150,
    });
  }

  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      colorProgress.value,
      [0, 1],
      ['rgba(153, 153, 153, 1)', '#000000']
    );

    return {
      width: width.value,
      backgroundColor: bgColor,
    };
  });

  return (
    <Animated.View
      style={[
        {
          height: inactiveSize,
          borderRadius: inactiveSize / 2,
        },
        animatedStyle,
      ]}
    />
  );
};

interface TemplateCarouselProps {
  onPress: () => void;
}

const TemplateCarousel = ({ onPress }: TemplateCarouselProps) => {
  const scrollViewRef = useRef<RNScrollView>(null);
  const isWindowNarrow = useIsWindowNarrow();
  const [containerWidth, setContainerWidth] = useState(0);
  const [templateIndex, setTemplateIndex] = useState(0);

  const canScrollPrev = templateIndex > 0;
  const canScrollNext = templateIndex < groupTemplates.length - 1;

  const handleNext = useCallback(() => {
    if (!canScrollNext) return;
    setTemplateIndex((prev) => prev + 1);
    setTimeout(() => {
      const nextIndex = templateIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * containerWidth,
        animated: true,
      });
    }, 0);
  }, [templateIndex, containerWidth, canScrollNext]);

  const handlePrev = useCallback(() => {
    if (!canScrollPrev) return;
    setTemplateIndex((prev) => prev - 1);
    setTimeout(() => {
      const prevIndex = templateIndex - 1;
      scrollViewRef.current?.scrollTo({
        x: prevIndex * containerWidth,
        animated: true,
      });
    }, 0);
  }, [templateIndex, containerWidth, canScrollPrev]);

  const handleScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      if (!containerWidth) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / containerWidth);

      const clampedIndex = Math.max(
        0,
        Math.min(newIndex, groupTemplates.length - 1)
      );

      if (clampedIndex !== templateIndex) {
        setTemplateIndex(clampedIndex);
      }

      scrollViewRef.current?.scrollTo({
        x: clampedIndex * containerWidth,
        animated: true,
      });
    },
    [containerWidth, templateIndex]
  );

  return (
    <YStack
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <XStack position="relative">
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={isWindowNarrow}
          pagingEnabled={isWindowNarrow}
          onMomentumScrollEnd={isWindowNarrow ? handleScrollEnd : undefined}
          flex={1}
        >
          {groupTemplates.map((template) => (
            <View key={template.id} width={containerWidth || '100%'}>
              <GroupTypeCard
                icon={template.icon}
                title={template.title}
                subtitle={template.subtitle}
                onPress={onPress}
              />
            </View>
          ))}
        </ScrollView>
        {!isWindowNarrow && canScrollPrev && (
          <CarouselArrow direction="left" onPress={handlePrev} />
        )}
        {!isWindowNarrow && canScrollNext && (
          <CarouselArrow direction="right" onPress={handleNext} />
        )}
      </XStack>
      <PaginationDots
        total={groupTemplates.length}
        activeIndex={templateIndex}
      />
    </YStack>
  );
};

export function GroupTypeSelectionSheet({
  open,
  onOpenChange,
  onSelectGroupType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGroupType: (type: GroupType) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();

  const content = (
    <YStack flex={1} gap="$l" paddingBottom={bottom}>
      <ActionSheet.SimpleHeader
        title="Create a group"
        subtitle="Choose how you'd like to set up your group"
      />
      <YStack gap="$m" paddingHorizontal="$xl">
        <GroupTypeCard
          icon="Channel"
          title="Quick group"
          subtitle="Start chatting right away with default settings"
          onPress={() => onSelectGroupType('quick')}
        />
        <GroupTypeCard
          icon="Discover"
          title="Custom group"
          subtitle="Customize channels, roles, and privacy settings"
          onPress={() => onSelectGroupType('custom')}
        />
        <TemplateCarousel onPress={() => onSelectGroupType('template')} />
      </YStack>
    </YStack>
  );

  if (!isWindowNarrow) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={onOpenChange}
        mode="dialog"
        closeButton
        dialogContentProps={{ width: 600 }}
      >
        <View flex={1} padding="$m">
          {content}
        </View>
      </ActionSheet>
    );
  }

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[90]}
      snapPointsMode="percent"
    >
      {content}
    </ActionSheet>
  );
}
