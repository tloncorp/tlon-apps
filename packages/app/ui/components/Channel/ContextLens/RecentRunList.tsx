import { Pressable } from '@tloncorp/ui';
import { SizableText, View, XStack, YStack } from 'tamagui';

import {
  TONE_COLORS,
  formatWallDateTime,
  pluralize,
  runMeta,
  runPreview,
  statusLabel,
  statusTone,
} from './format';
import type { ContextLensEvent } from './types';

export function RecentRunList({
  runs,
  activeLensId,
  followLatest,
  expanded,
  visibleCount,
  onSelectRun,
  onFollowLatest,
  onToggleExpanded,
  onShowMore,
}: {
  runs: ContextLensEvent[];
  activeLensId?: string | null;
  followLatest: boolean;
  expanded: boolean;
  visibleCount: number;
  onSelectRun: (event: ContextLensEvent) => void;
  onFollowLatest: () => void;
  onToggleExpanded: () => void;
  onShowMore: () => void;
}) {
  if (!runs.length) {
    return null;
  }

  const visibleRuns = expanded ? runs.slice(0, visibleCount) : [];
  const hasMore = visibleCount < runs.length;

  return (
    <YStack
      gap="$s"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      padding="$m"
      backgroundColor="$secondaryBackground"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$s">
        <YStack flex={1} minWidth={0} gap="$2xs">
          <SizableText
            size="$s"
            color="$tertiaryText"
            textTransform="uppercase"
            letterSpacing={0}
          >
            Recent runs
          </SizableText>
          <SizableText size="$s" color="$tertiaryText">
            {pluralize(runs.length, 'run')} available
          </SizableText>
        </YStack>
        <XStack gap="$xs" flexShrink={0}>
          <Pressable
            onPress={onToggleExpanded}
            cursor="pointer"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$s"
            paddingHorizontal="$s"
            paddingVertical="$2xs"
            backgroundColor="$background"
          >
            <SizableText size="$s" color="$secondaryText">
              {expanded ? 'Hide' : 'Show'}
            </SizableText>
          </Pressable>
          <Pressable
            onPress={onFollowLatest}
            cursor="pointer"
            borderWidth={1}
            borderColor={followLatest ? '$positiveBorder' : '$border'}
            borderRadius="$s"
            paddingHorizontal="$s"
            paddingVertical="$2xs"
            backgroundColor={
              followLatest ? '$positiveBackground' : '$background'
            }
          >
            <SizableText
              size="$s"
              color={followLatest ? '$positiveActionText' : '$secondaryText'}
            >
              Latest
            </SizableText>
          </Pressable>
        </XStack>
      </XStack>

      {expanded ? (
        <YStack gap="$xs">
          {visibleRuns.map((event) => {
            const selected =
              !followLatest && activeLensId === event.lens.lensId;
            const tone = TONE_COLORS[statusTone(event.lens.status)];
            return (
              <Pressable
                key={event.lens.lensId}
                onPress={() => onSelectRun(event)}
                cursor="pointer"
                gap="$2xs"
                minWidth={0}
                borderWidth={1}
                borderColor={selected ? '$activeBorder' : '$border'}
                borderLeftWidth={2}
                borderLeftColor={tone}
                borderRadius="$s"
                paddingHorizontal="$s"
                paddingVertical="$xs"
                backgroundColor={
                  selected ? '$secondaryBackground' : '$background'
                }
              >
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$s"
                >
                  <XStack alignItems="center" gap="$xs" flex={1} minWidth={0}>
                    <View
                      width={7}
                      height={7}
                      borderRadius={999}
                      backgroundColor={tone}
                    />
                    <SizableText
                      size="$s"
                      color="$primaryText"
                      flex={1}
                      minWidth={0}
                      numberOfLines={1}
                    >
                      {statusLabel(event.lens.status)}
                    </SizableText>
                  </XStack>
                  <SizableText size="$s" color="$tertiaryText" flexShrink={0}>
                    {formatWallDateTime(event.lens.updatedAt)}
                  </SizableText>
                </XStack>
                <SizableText size="$s" color="$secondaryText" numberOfLines={2}>
                  {runPreview(event.lens)}
                </SizableText>
                <SizableText size="$s" color="$tertiaryText">
                  {runMeta(event.lens)}
                </SizableText>
              </Pressable>
            );
          })}
          {hasMore ? (
            <Pressable
              onPress={onShowMore}
              cursor="pointer"
              justifyContent="center"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$s"
              paddingHorizontal="$s"
              paddingVertical="$xs"
              backgroundColor="$background"
            >
              <SizableText size="$s" color="$positiveActionText">
                Show {Math.min(8, runs.length - visibleCount)} more
              </SizableText>
            </Pressable>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
