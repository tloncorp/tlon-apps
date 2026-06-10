import { SizableText, View, XStack, YStack } from 'tamagui';

import {
  type LensTone,
  TONE_COLORS,
  formatDuration,
  formatToolName,
  pluralize,
  statusLabel,
  statusTone,
  summarizeContext,
  summarizeToolEvents,
} from './format';
import { type ContextLensEvent, FINAL_STATUSES } from './types';

export type TimelineRow = {
  key: string;
  title: string;
  detail: string;
  meta: string;
  tone: LensTone;
  active?: boolean;
};

export function buildRunTimeline(
  events: ContextLensEvent[],
  latest: ContextLensEvent,
  now: number
) {
  const lens = latest.lens;
  const rows: TimelineRow[] = [
    {
      key: 'context',
      title: 'Assembled context',
      detail: summarizeContext(lens),
      meta: events.find((event) => event.phase === 'created')
        ? 'created'
        : 'ready',
      tone: 'neutral',
    },
  ];

  if (lens.lifecycle.queuedMs || lens.lifecycle.queuedBlockCount) {
    rows.push({
      key: 'queue',
      title: lens.lifecycle.queuedBlockCount ? 'Waited for session' : 'Queued',
      detail: [
        lens.lifecycle.queuedMs
          ? `${formatDuration(lens.lifecycle.queuedMs)} wait`
          : null,
        lens.lifecycle.queuedBlockCount
          ? pluralize(lens.lifecycle.queuedBlockCount, 'blocked run')
          : null,
      ]
        .filter(Boolean)
        .join(' / '),
      meta: 'queue',
      tone: 'warning',
    });
  }

  const modelEvent = events.find((event) => event.phase === 'model_selected');
  rows.push({
    key: 'model',
    title: modelEvent ? 'Selected model' : 'Model pending',
    detail:
      lens.provider || lens.model
        ? [lens.provider, lens.model].filter(Boolean).join(' / ')
        : 'waiting for provider',
    meta: modelEvent ? `#${modelEvent.seq}` : 'pending',
    tone: modelEvent ? 'neutral' : 'warning',
    active: !modelEvent && !FINAL_STATUSES.has(lens.status),
  });

  const tools = summarizeToolEvents(events, lens);
  if (tools) {
    rows.push({
      key: 'tools',
      title:
        lens.status === 'tool_running' && tools.latest
          ? `Using ${formatToolName(tools.latest)}`
          : 'Used tools',
      detail: `${tools.summary} · ${pluralize(tools.total, 'call')}`,
      meta: 'tools',
      tone: lens.status === 'tool_running' ? 'neutral' : 'positive',
      active: lens.status === 'tool_running',
    });
  }

  if (FINAL_STATUSES.has(lens.status) || lens.status === 'delivering') {
    rows.push({
      key: 'delivery',
      title:
        lens.status === 'completed'
          ? 'Delivered reply'
          : lens.status === 'no_reply'
            ? 'No reply emitted'
            : lens.status === 'timed_out'
              ? 'Timed out'
              : lens.status === 'error'
                ? 'Run failed'
                : 'Delivering reply',
      detail:
        lens.status === 'error' && lens.error
          ? lens.error
          : [
              pluralize(lens.lifecycle.deliveredMessageCount, 'message'),
              formatDuration(lens.lifecycle.durationMs),
            ].join(' / '),
      meta: latest.phase,
      tone: statusTone(lens.status),
      active: lens.status === 'delivering',
    });
  } else {
    rows.push({
      key: 'live',
      title: statusLabel(lens.status),
      detail: `running for ${formatDuration(now - lens.createdAt)}`,
      meta: latest.phase,
      tone: statusTone(lens.status),
      active: true,
    });
  }

  return rows;
}

export function RunTimeline({ rows }: { rows: TimelineRow[] }) {
  if (!rows.length) {
    return null;
  }
  return (
    <YStack gap="$s">
      <SizableText
        size="$s"
        color="$tertiaryText"
        textTransform="uppercase"
        letterSpacing={0}
      >
        Run timeline
      </SizableText>
      {rows.map((row, index) => (
        <TimelineItem
          key={row.key}
          row={row}
          isLast={index === rows.length - 1}
        />
      ))}
    </YStack>
  );
}

function TimelineItem({ row, isLast }: { row: TimelineRow; isLast: boolean }) {
  return (
    <XStack gap="$s" alignItems="stretch">
      <YStack alignItems="center" width={14}>
        <View
          width={7}
          height={7}
          borderRadius={999}
          marginTop={10}
          backgroundColor={TONE_COLORS[row.tone]}
        />
        {!isLast ? (
          <View flex={1} width={1} marginTop="$2xs" backgroundColor="$border" />
        ) : null}
      </YStack>
      <YStack
        flex={1}
        gap="$2xs"
        borderWidth={1}
        borderColor={row.active ? '$activeBorder' : '$border'}
        borderRadius="$s"
        paddingHorizontal="$s"
        paddingVertical="$xs"
        backgroundColor={row.active ? '$secondaryBackground' : 'unset'}
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$s">
          <SizableText size="$s" color="$primaryText" flex={1}>
            {row.title}
          </SizableText>
          <SizableText size="$s" color="$tertiaryText">
            {row.meta}
          </SizableText>
        </XStack>
        <SizableText size="$s" color="$secondaryText">
          {row.detail}
        </SizableText>
      </YStack>
    </XStack>
  );
}
