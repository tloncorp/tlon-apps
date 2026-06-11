import { SizableText, View, XStack, YStack } from 'tamagui';

import {
  TONE_COLORS,
  formatDuration,
  runKindLabel,
  statusLabel,
  statusTone,
  summarizeContext,
  summarizeWrites,
} from './format';
import { Metric } from './primitives';
import { type ContextLens } from './types';

export function RunSummary({
  lens,
  phase,
}: {
  lens: ContextLens;
  phase?: string;
}) {
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
        </XStack>
        {phase ? (
          <SizableText size="$s" color="$secondaryText">
            {phase}
          </SizableText>
        ) : null}
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
