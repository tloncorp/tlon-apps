import { Icon, Pressable } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  View as NativeView,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import {
  Circle,
  SizableText,
  View,
  XStack,
  YStack,
  getVariableValue,
  useTheme,
} from 'tamagui';

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AgentTaskDetail = {
  label: string;
  value: string;
};

export type AgentTaskRow = {
  id: string;
  title: string;
  status: AgentTaskStatus;
  sequence: number;
  meta?: string;
  details?: AgentTaskDetail[];
  /** A determinate ring value from 0 to 1. Omit for an indeterminate ring. */
  progress?: number;
};

export type AgentTaskRowsProps = {
  rows: AgentTaskRow[];
  variant?: 'capsules' | 'list';
  /** Moves automatic disclosure to a row; manual choices take precedence. */
  autoExpandedId?: string;
  expandedIds?: readonly string[];
  onExpandedChange?: (id: string, expanded: boolean) => void;
  testID?: string;
};

const RING_SIZE = 24;
const RING_STROKE = 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

function statusLabel(status: AgentTaskStatus) {
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  return null;
}

function ProgressRing({
  sequence,
  progress,
}: {
  sequence: number;
  progress?: number;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(-90);
  const animatedProgress = useSharedValue(0);
  const determinate = progress != null;

  useEffect(() => {
    if (determinate) {
      rotation.value = -90;
      animatedProgress.value = withTiming(Math.max(0, Math.min(progress, 1)), {
        duration: reducedMotion ? 1 : 650,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    animatedProgress.value = 0.28;
    rotation.value = reducedMotion
      ? -90
      : withRepeat(
          withTiming(270, {
            duration: 1100,
            easing: Easing.linear,
          }),
          -1,
          false
        );
  }, [animatedProgress, determinate, progress, reducedMotion, rotation]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const activeCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: determinate
      ? RING_CIRCUMFERENCE * (1 - animatedProgress.value)
      : 0,
  }));
  const activeColor = getVariableValue(theme.secondaryText);
  const trackColor = getVariableValue(theme.border);

  return (
    <NativeView style={styles.ringFrame}>
      <Animated.View style={[styles.ringSvg, ringStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={trackColor}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedSvgCircle
            animatedProps={activeCircleProps}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={activeColor}
            strokeWidth={RING_STROKE}
            strokeDasharray={
              determinate
                ? `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`
                : `${RING_CIRCUMFERENCE * 0.28} ${RING_CIRCUMFERENCE * 0.72}`
            }
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
      <SizableText
        size="$xs"
        color="$secondaryText"
        lineHeight={14}
        fontVariant={['tabular-nums']}
      >
        {sequence}
      </SizableText>
    </NativeView>
  );
}

function RotatingRetryIcon() {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = reducedMotion
      ? 0
      : withRepeat(
          withTiming(360, { duration: 1100, easing: Easing.linear }),
          -1,
          false
        );
  }, [reducedMotion, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Icon type="Refresh" customSize={[16, 12]} color="$negativeActionText" />
    </Animated.View>
  );
}

function TaskStatus({ row }: { row: AgentTaskRow }) {
  const reducedMotion = useReducedMotion();
  const entering = reducedMotion
    ? undefined
    : FadeIn.duration(300).easing(Easing.out(Easing.cubic));

  if (row.status === 'running') {
    return <ProgressRing sequence={row.sequence} progress={row.progress} />;
  }

  if (row.status === 'pending') {
    return (
      <Circle size={RING_SIZE} borderWidth={1} borderColor="$border">
        <SizableText
          size="$xs"
          color="$tertiaryText"
          lineHeight={14}
          fontVariant={['tabular-nums']}
        >
          {row.sequence}
        </SizableText>
      </Circle>
    );
  }

  return (
    <Animated.View key={row.status} entering={entering}>
      <Circle
        size={RING_SIZE}
        backgroundColor={
          row.status === 'completed'
            ? '$positiveActionText'
            : '$negativeActionText'
        }
      >
        <Icon
          type={row.status === 'completed' ? 'Checkmark' : 'Close'}
          customSize={[RING_SIZE, 14]}
          color="$background"
        />
      </Circle>
    </Animated.View>
  );
}

function StatusPill({ status }: { status: AgentTaskStatus }) {
  const label = statusLabel(status);
  if (!label) return null;

  return (
    <XStack
      height={22}
      alignItems="center"
      gap="$2xs"
      paddingHorizontal="$s"
      borderRadius="$xl"
      backgroundColor={
        status === 'completed' ? '$positiveBackground' : '$negativeBackground'
      }
    >
      {status === 'failed' ? <RotatingRetryIcon /> : null}
      <SizableText
        size="$xs"
        lineHeight={16}
        color={
          status === 'completed' ? '$positiveActionText' : '$negativeActionText'
        }
      >
        {label}
      </SizableText>
    </XStack>
  );
}

function Chevron({ open }: { open: boolean }) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(open ? 180 : 0);

  useEffect(() => {
    rotation.value = withTiming(open ? 180 : 0, {
      duration: reducedMotion ? 1 : 300,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [open, reducedMotion, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Icon type="ChevronDown" customSize={[24, 15]} color="$tertiaryText" />
    </Animated.View>
  );
}

function TaskDetails({ details }: { details: AgentTaskDetail[] }) {
  const reducedMotion = useReducedMotion();

  return (
    <XStack
      gap="$m"
      paddingLeft={22}
      paddingRight="$l"
      paddingVertical="$l"
      alignItems="stretch"
    >
      <View width={1} backgroundColor="$border" />
      <YStack flex={1} gap="$m" minWidth={0}>
        {details.map((detail, index) => (
          <Animated.View
            key={`${detail.label}-${index}`}
            entering={
              reducedMotion
                ? undefined
                : FadeInUp.delay(120 + index * 100)
                    .duration(300)
                    .easing(Easing.out(Easing.cubic))
            }
          >
            <XStack
              justifyContent="space-between"
              alignItems="flex-start"
              gap="$l"
              minWidth={0}
            >
              <SizableText size="$xs" color="$tertiaryText" flexShrink={0}>
                {detail.label}
              </SizableText>
              <SizableText
                size="$xs"
                color="$secondaryText"
                textAlign="right"
                flex={1}
                minWidth={0}
              >
                {detail.value}
              </SizableText>
            </XStack>
          </Animated.View>
        ))}
      </YStack>
    </XStack>
  );
}

function TaskDetailsDisclosure({
  open,
  details,
}: {
  open: boolean;
  details: AgentTaskDetail[];
}) {
  const reducedMotion = useReducedMotion();
  const measuredHeight = useSharedValue(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(open ? 1 : 0);

  const animateHeight = useCallback(
    (nextHeight: number) => {
      height.value = withTiming(nextHeight, {
        duration: reducedMotion ? 1 : 300,
        easing: Easing.inOut(Easing.cubic),
      });
    },
    [height, reducedMotion]
  );

  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextHeight = event.nativeEvent.layout.height;
      measuredHeight.value = nextHeight;
      if (open) animateHeight(nextHeight);
    },
    [animateHeight, measuredHeight, open]
  );

  useEffect(() => {
    animateHeight(open ? measuredHeight.value : 0);
    opacity.value = withTiming(open ? 1 : 0, {
      duration: reducedMotion ? 1 : open ? 220 : 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [animateHeight, measuredHeight, open, opacity, reducedMotion]);

  const disclosureStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.detailsDisclosure, disclosureStyle]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <NativeView onLayout={onContentLayout} collapsable={false}>
        <TaskDetails details={details} />
      </NativeView>
    </Animated.View>
  );
}

function TaskRow({
  row,
  index,
  open,
  variant,
  isLast,
  onToggle,
}: {
  row: AgentTaskRow;
  index: number;
  open: boolean;
  variant: 'capsules' | 'list';
  isLast: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const radius = useSharedValue(variant === 'list' ? 0 : open ? 14 : 22);
  const hasDetails = !!row.details?.length;
  const entering = reducedMotion
    ? undefined
    : FadeInUp.delay(index * 80)
        .duration(450)
        .easing(Easing.out(Easing.cubic));
  const radiusStyle = useAnimatedStyle(() => ({
    borderRadius: radius.value,
  }));

  useEffect(() => {
    radius.value = withTiming(variant === 'list' ? 0 : open ? 14 : 22, {
      duration: reducedMotion ? 1 : 300,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [open, radius, reducedMotion, variant]);

  return (
    <Animated.View
      entering={entering}
      style={
        variant === 'capsules'
          ? {
              elevation: 1,
              shadowColor: getVariableValue(theme.shadow),
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.7,
              shadowRadius: 9,
            }
          : undefined
      }
    >
      <Animated.View style={[styles.rowSurface, radiusStyle]}>
        <YStack
          backgroundColor="$background"
          borderBottomWidth={variant === 'list' && !isLast ? 1 : 0}
          borderBottomColor="$border"
        >
          <Pressable
            onPress={hasDetails ? onToggle : undefined}
            role={hasDetails ? 'button' : undefined}
            aria-expanded={hasDetails ? open : undefined}
            accessibilityRole={hasDetails ? 'button' : undefined}
            accessibilityLabel={`${row.title}${statusLabel(row.status) ? `, ${statusLabel(row.status)}` : ''}`}
            accessibilityState={hasDetails ? { expanded: open } : undefined}
            minHeight={44}
            paddingHorizontal="$l"
            hoverStyle={{ backgroundColor: '$secondaryBackground' }}
            pressStyle={{
              backgroundColor: '$secondaryBackground',
              opacity: 0.82,
            }}
            focusStyle={{ outlineColor: '$primaryText', outlineWidth: 2 }}
          >
            <XStack minHeight={44} alignItems="center" gap="$m">
              <TaskStatus row={row} />
              <SizableText
                size="$s"
                color="$primaryText"
                flex={1}
                minWidth={0}
                numberOfLines={2}
              >
                {row.title}
              </SizableText>
              <StatusPill status={row.status} />
              {row.meta ? (
                <SizableText
                  size="$xs"
                  color="$tertiaryText"
                  flexShrink={0}
                  fontVariant={['tabular-nums']}
                >
                  {row.meta}
                </SizableText>
              ) : null}
              {hasDetails ? <Chevron open={open} /> : null}
            </XStack>
          </Pressable>
          {row.details ? (
            <TaskDetailsDisclosure open={open} details={row.details} />
          ) : null}
        </YStack>
      </Animated.View>
    </Animated.View>
  );
}

export function AgentTaskRows({
  rows,
  variant = 'capsules',
  autoExpandedId,
  expandedIds,
  onExpandedChange,
  testID,
}: AgentTaskRowsProps) {
  const [manualExpanded, setManualExpanded] = useState<
    Record<string, boolean | undefined>
  >({});
  const [lastAutoExpandedId, setLastAutoExpandedId] = useState<
    string | undefined
  >();
  const controlledExpanded = useMemo(
    () => (expandedIds ? new Set(expandedIds) : null),
    [expandedIds]
  );

  useEffect(() => {
    if (autoExpandedId) setLastAutoExpandedId(autoExpandedId);
  }, [autoExpandedId]);

  const toggle = useCallback(
    (id: string, currentlyOpen: boolean) => {
      const next = !currentlyOpen;
      if (!controlledExpanded) {
        setManualExpanded((current) => ({ ...current, [id]: next }));
      }
      onExpandedChange?.(id, next);
    },
    [controlledExpanded, onExpandedChange]
  );

  if (!rows.length) return null;

  const content = rows.map((row, index) => {
    const open = controlledExpanded
      ? controlledExpanded.has(row.id)
      : manualExpanded[row.id] ?? row.id === lastAutoExpandedId;

    return (
      <TaskRow
        key={row.id}
        row={row}
        index={index}
        open={open}
        variant={variant}
        isLast={index === rows.length - 1}
        onToggle={() => toggle(row.id, open)}
      />
    );
  });

  if (variant === 'list') {
    return (
      <YStack
        testID={testID}
        borderRadius={22}
        overflow="hidden"
        backgroundColor="$background"
        shadowColor="$shadow"
        shadowOffset={{ width: 0, height: 3 }}
        shadowOpacity={0.7}
        shadowRadius={9}
        elevation={1}
      >
        {content}
      </YStack>
    );
  }

  return (
    <YStack testID={testID} gap="$m" minHeight={196}>
      {content}
    </YStack>
  );
}

const styles = StyleSheet.create({
  ringFrame: {
    alignItems: 'center',
    height: RING_SIZE,
    justifyContent: 'center',
    position: 'relative',
    width: RING_SIZE,
  },
  ringSvg: {
    height: RING_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: RING_SIZE,
  },
  rowSurface: {
    overflow: 'hidden',
  },
  detailsDisclosure: {
    overflow: 'hidden',
  },
});
