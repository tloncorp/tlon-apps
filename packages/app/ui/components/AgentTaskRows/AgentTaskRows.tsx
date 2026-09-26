import { Icon, Pressable } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View as NativeView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
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

import { useIsDarkMode } from '../../../hooks/useDarkMode';
import { activateAgentControlFromKeyboard } from './keyboardControl';

export type AgentTaskStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed';

export type AgentTaskDetail = {
  label: string;
  value: string;
};

export type AgentTaskRow = {
  id: string;
  title: string;
  /** Concise user-facing progress that stays visible while details are closed. */
  subtitle?: string;
  status: AgentTaskStatus;
  /** Distinguishes requester input from an owner approval gate. */
  waitingLabel?: 'Waiting on you' | 'Waiting for approval';
  sequence: number;
  meta?: string;
  details?: AgentTaskDetail[];
  /** A determinate ring value from 0 to 1. Omit for an indeterminate ring. */
  progress?: number;
};

export type AgentTaskRowsProps = {
  rows: AgentTaskRow[];
  variant?: 'capsules' | 'list';
  density?: 'default' | 'comfortable';
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

export function agentTaskStatusLabel(
  status: AgentTaskStatus,
  waitingLabel: AgentTaskRow['waitingLabel'] = 'Waiting on you'
) {
  if (status === 'pending') return 'Not started';
  if (status === 'running') return 'In progress';
  if (status === 'waiting') return waitingLabel;
  if (status === 'completed') return 'Completed';
  return 'Failed';
}

function statusPillLabel(
  status: AgentTaskStatus,
  waitingLabel: AgentTaskRow['waitingLabel'] = 'Waiting on you'
) {
  if (status === 'waiting') return waitingLabel;
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
    <NativeView
      style={styles.ringFrame}
      role="progressbar"
      aria-label={`Task ${sequence}, in progress`}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={
        determinate ? Math.round((progress ?? 0) * 100) : undefined
      }
      aria-valuetext={determinate ? undefined : 'In progress'}
    >
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
      <Circle
        size={RING_SIZE}
        borderWidth={1}
        borderColor="$border"
        aria-label={`Task ${row.sequence}, not started`}
      >
        <SizableText
          size="$xs"
          color="$secondaryText"
          lineHeight={14}
          fontVariant={['tabular-nums']}
        >
          {row.sequence}
        </SizableText>
      </Circle>
    );
  }

  if (row.status === 'waiting') {
    return (
      <Circle
        size={RING_SIZE}
        borderWidth={1}
        borderColor="$secondaryText"
        aria-label={`Task ${row.sequence}, ${agentTaskStatusLabel(
          row.status,
          row.waitingLabel
        ).toLowerCase()}`}
      >
        <Icon
          type="Clock"
          customSize={[RING_SIZE, 14]}
          color="$secondaryText"
        />
      </Circle>
    );
  }

  return (
    <Animated.View
      key={row.status}
      entering={entering}
      aria-label={`Task ${row.sequence}, ${agentTaskStatusLabel(row.status).toLowerCase()}`}
    >
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

function StatusPill({ row }: { row: AgentTaskRow }) {
  const label = statusPillLabel(row.status, row.waitingLabel);
  if (!label) return null;

  return (
    <XStack
      height={22}
      alignItems="center"
      gap="$2xs"
      paddingHorizontal="$s"
      borderRadius="$xl"
      backgroundColor={
        row.status === 'completed'
          ? '$positiveBackground'
          : row.status === 'failed'
            ? '$negativeBackground'
            : '$secondaryBackground'
      }
    >
      <SizableText size="$xs" lineHeight={16} color="$primaryText">
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
      <Icon type="ChevronDown" customSize={[24, 15]} color="$secondaryText" />
    </Animated.View>
  );
}

function TaskDetails({ details }: { details: AgentTaskDetail[] }) {
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
          <YStack key={`${detail.label}-${index}`} gap="$2xs" minWidth={0}>
            <SizableText size="$xs" color="$secondaryText">
              {detail.label}
            </SizableText>
            <SizableText
              size="$s"
              lineHeight={20}
              color="$secondaryText"
              minWidth={0}
            >
              {detail.value}
            </SizableText>
          </YStack>
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
  if (!open) return null;
  return <TaskDetails details={details} />;
}

function TaskRow({
  row,
  open,
  variant,
  density,
  isLast,
  onToggle,
}: {
  row: AgentTaskRow;
  open: boolean;
  variant: 'capsules' | 'list';
  density: 'default' | 'comfortable';
  isLast: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const isDark = useIsDarkMode();
  const reducedMotion = useReducedMotion();
  const radius = useSharedValue(variant === 'list' ? 0 : open ? 14 : 22);
  const hasDetails = !!row.details?.length;
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
      style={
        variant === 'capsules'
          ? isDark
            ? undefined
            : {
                elevation: 1,
                shadowColor: getVariableValue(theme.shadow),
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.7,
                shadowRadius: 9,
              }
          : undefined
      }
    >
      <Animated.View
        style={[
          styles.rowSurface,
          radiusStyle,
          variant === 'capsules' && isDark
            ? {
                borderColor: getVariableValue(theme.border),
                borderWidth: 1,
              }
            : undefined,
        ]}
      >
        <YStack
          backgroundColor="$background"
          borderBottomWidth={variant === 'list' && !isLast ? 1 : 0}
          borderBottomColor="$border"
        >
          <Pressable
            onPress={hasDetails ? onToggle : undefined}
            onKeyDown={
              hasDetails
                ? (event) => activateAgentControlFromKeyboard(event, onToggle)
                : undefined
            }
            role={hasDetails ? 'button' : undefined}
            aria-expanded={hasDetails ? open : undefined}
            aria-label={`${row.title}${row.subtitle ? `, ${row.subtitle}` : ''}, ${agentTaskStatusLabel(row.status, row.waitingLabel)}`}
            disabled={!hasDetails}
            tabIndex={hasDetails ? 0 : undefined}
            cursor={hasDetails ? 'pointer' : 'default'}
            minHeight={density === 'comfortable' ? 52 : 44}
            paddingHorizontal={density === 'comfortable' ? '$xl' : '$l'}
            paddingVertical={
              density === 'comfortable' || row.subtitle ? '$s' : 0
            }
            hoverStyle={
              hasDetails
                ? { backgroundColor: '$secondaryBackground' }
                : undefined
            }
            pressStyle={
              hasDetails
                ? {
                    backgroundColor: '$secondaryBackground',
                    opacity: 0.82,
                  }
                : undefined
            }
            focusVisibleStyle={
              hasDetails
                ? {
                    outlineColor: '$primaryText',
                    outlineOffset: 2,
                    outlineStyle: 'solid',
                    outlineWidth: 2,
                  }
                : undefined
            }
          >
            <XStack minHeight={44} alignItems="center" gap="$m">
              <TaskStatus row={row} />
              <YStack flex={1} minWidth={0} gap="$2xs">
                <SizableText
                  size="$s"
                  color="$primaryText"
                  minWidth={0}
                  numberOfLines={2}
                >
                  {row.title}
                </SizableText>
                {row.subtitle ? (
                  <SizableText
                    size="$xs"
                    lineHeight={16}
                    color="$secondaryText"
                    minWidth={0}
                    numberOfLines={2}
                  >
                    {row.subtitle}
                  </SizableText>
                ) : null}
              </YStack>
              {statusPillLabel(row.status, row.waitingLabel) || row.meta ? (
                <YStack flexShrink={0} alignItems="flex-end" gap="$2xs">
                  <StatusPill row={row} />
                  {row.meta ? (
                    <SizableText
                      size="$xs"
                      color="$secondaryText"
                      fontVariant={['tabular-nums']}
                    >
                      {row.meta}
                    </SizableText>
                  ) : null}
                </YStack>
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
  density = 'default',
  autoExpandedId,
  expandedIds,
  onExpandedChange,
  testID,
}: AgentTaskRowsProps) {
  const isDark = useIsDarkMode();
  const [manualExpanded, setManualExpanded] = useState<
    Record<string, boolean | undefined>
  >({});
  const controlledExpanded = useMemo(
    () => (expandedIds ? new Set(expandedIds) : null),
    [expandedIds]
  );

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
      : manualExpanded[row.id] ?? row.id === autoExpandedId;

    return (
      <TaskRow
        key={row.id}
        row={row}
        open={open}
        variant={variant}
        density={density}
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
        borderColor={isDark ? '$border' : undefined}
        borderWidth={isDark ? 1 : 0}
        shadowColor="$shadow"
        shadowOffset={{ width: 0, height: 3 }}
        shadowOpacity={isDark ? 0 : 0.7}
        shadowRadius={isDark ? 0 : 9}
        elevation={isDark ? 0 : 1}
      >
        {content}
      </YStack>
    );
  }

  return (
    <YStack testID={testID} gap="$m">
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
});
