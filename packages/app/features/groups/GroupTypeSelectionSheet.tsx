import { GroupTemplateId, groupTemplates } from '@tloncorp/shared';
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
import { ScrollView, View, XStack, YStack, getTokens, useTheme } from 'tamagui';

import { ActionSheet, ListItem, useIsWindowNarrow } from '../../ui';

export type GroupType = 'quick' | 'custom' | 'template';

interface GroupTypeCardProps {
  icons: (IconType | string)[];
  title: string;
  subtitle: string;
  onPress: () => void;
}

const GroupTypeCard = ({
  icons,
  title,
  subtitle,
  onPress,
}: GroupTypeCardProps) => {
  return (
    <Pressable onPress={onPress} style={{ cursor: 'pointer' }}>
      {({ pressed }) => (
        <YStack
          borderWidth={1}
          borderColor="$border"
          borderRadius="$l"
          padding="$2xl"
          height={180}
          backgroundColor={pressed ? '$secondaryBackground' : '$background'}
          justifyContent="space-between"
        >
          <YStack flex={1} justifyContent="flex-start">
            <XStack gap="$xs">
              {icons.map((icon, index) => {
                const isEmoji = typeof icon === 'string' && icon.length <= 4;
                return isEmoji ? (
                  <Text key={index} fontSize={32}>
                    {icon}
                  </Text>
                ) : (
                  <ListItem.SystemIcon
                    key={index}
                    width={'$3.5xl'}
                    height={'$3.5xl'}
                    icon={icon as IconType}
                  />
                );
              })}
            </XStack>
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
  const theme = useTheme();
  const width = useSharedValue(inactiveSize);
  const colorProgress = useSharedValue(0);

  const inactiveColor = theme.tertiaryText.val;
  const activeColor = theme.primaryText.val;

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
      [inactiveColor, activeColor]
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
  onPress: (templateId: GroupTemplateId) => void;
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

  const handleScroll = useCallback(
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
    },
    [containerWidth, templateIndex]
  );

  return (
    <YStack
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <XStack
        position="relative"
        marginRight={isWindowNarrow ? '$-xl' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={isWindowNarrow}
          snapToInterval={
            isWindowNarrow
              ? containerWidth + getTokens().space.l.val
              : undefined
          }
          decelerationRate={'fast'}
          onScroll={isWindowNarrow ? handleScroll : undefined}
          scrollEventThrottle={16}
          contentContainerStyle={
            isWindowNarrow ? { paddingRight: '$xl', gap: '$l' } : {}
          }
          flex={1}
        >
          {groupTemplates.map((template) => (
            <View key={template.id} width={containerWidth || '100%'}>
              <GroupTypeCard
                icons={[template.icon]}
                title={template.title}
                subtitle={template.subtitle}
                onPress={() => onPress(template.id)}
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
  onSelectGroupType: (type: GroupType, templateId?: GroupTemplateId) => void;
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
          icons={['ChannelTalk']}
          title="Quick group"
          subtitle="Start chatting right away with default settings"
          onPress={() => onSelectGroupType('quick')}
        />
        <GroupTypeCard
          icons={['ChannelTalk', 'ChannelGalleries', 'ChannelNotebooks']}
          title="Basic group"
          subtitle="Group with chat, gallery, and notebook channels"
          onPress={() => onSelectGroupType('template', 'basic-group')}
        />
        <TemplateCarousel
          onPress={(templateId) => onSelectGroupType('template', templateId)}
        />
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
