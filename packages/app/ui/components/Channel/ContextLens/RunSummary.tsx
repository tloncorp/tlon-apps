import { Pressable } from '@tloncorp/ui';
import { useState } from 'react';
import { SizableText, View, XStack, YStack } from 'tamagui';

import {
  TONE_COLORS,
  canRetryLens,
  formatDuration,
  formatWallTime,
  runKindLabel,
  statusLabel,
  statusTone,
  summarizeContext,
  summarizeWrites,
} from './format';
import { Metric } from './primitives';
import { type ContextLens } from './types';

const RETRY_COOLDOWN_MS = 5000;

export function RunSummary({
  lens,
  phase,
  onRetry,
}: {
  lens: ContextLens;
  phase?: string;
  onRetry?: () => Promise<void> | void;
}) {
  const [retrying, setRetrying] = useState(false);
  const showRetry = Boolean(onRetry) && canRetryLens(lens);
  const handleRetry = () => {
    if (retrying || !onRetry) {
      return;
    }
    setRetrying(true);
    Promise.resolve(onRetry()).catch(() => undefined);
    setTimeout(() => setRetrying(false), RETRY_COOLDOWN_MS);
  };
  return (
    <YStack
      gap="$m"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      padding="$m"
      backgroundColor="$secondaryBackground"
    >
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$s">
          <View
            width={9}
            height={9}
            borderRadius={999}
            backgroundColor={TONE_COLORS[statusTone(lens.status)]}
          />
          <SizableText size="$l" color="$primaryText">
            {statusLabel(lens.status)}
          </SizableText>
          {showRetry ? (
            <Pressable
              testID="LensRetryButton"
              onPress={handleRetry}
              disabled={retrying}
              cursor="pointer"
              borderWidth={1}
              borderColor="$border"
              borderRadius="$s"
              paddingHorizontal="$s"
              paddingVertical="$2xs"
              pressStyle={{ opacity: 0.6 }}
              opacity={retrying ? 0.5 : 1}
            >
              <SizableText size="$s" color="$positiveActionText">
                {retrying ? 'Retrying…' : 'Retry'}
              </SizableText>
            </Pressable>
          ) : null}
        </XStack>
        <SizableText size="$s" color="$secondaryText">
          {phase ?? formatWallTime(lens.updatedAt)}
        </SizableText>
      </XStack>

      <YStack gap="$s">
        <Metric label="Context" value={summarizeContext(lens)} />
        <Metric label="Run" value={runKindLabel(lens)} />
        <Metric
          label="Tools"
          value={
            lens.tools.callCount
              ? `${lens.tools.callCount} / ${lens.tools.called.join(', ')}`
              : 'none'
          }
        />
        <Metric label="Writes" value={summarizeWrites(lens)} />
        <Metric
          label="Model"
          value={
            lens.provider || lens.model
              ? [lens.provider, lens.model].filter(Boolean).join(' / ')
              : 'pending'
          }
        />
        <Metric
          label="Runtime"
          value={formatDuration(lens.lifecycle.durationMs)}
        />
      </YStack>

      {lens.error ? (
        <SizableText size="$s" color="$negativeActionText">
          {lens.error}
        </SizableText>
      ) : null}
    </YStack>
  );
}
