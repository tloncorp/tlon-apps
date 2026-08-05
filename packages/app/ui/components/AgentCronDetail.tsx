import type * as api from '@tloncorp/api';
import { makePrettyShortDate, makePrettyTime } from '@tloncorp/shared/logic';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import type { ComponentProps } from 'react';
import { ScrollView, View, XStack, YStack, styled } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { Badge } from './Badge';
import type { BadgeType } from './Badge';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

export type AgentCron = api.AgentCron;

export function AgentCronDetailSheet({
  open,
  onOpenChange,
  cron,
  fallbackCronId,
  title = 'Scheduled task',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cron?: AgentCron | null;
  fallbackCronId?: string;
  title?: string;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} modal title={title}>
      <ActionSheet.SimpleHeader title={title} />
      <ActionSheet.ScrollableContent>
        <ActionSheet.ContentBlock>
          <AgentCronDetailContent cron={cron} fallbackCronId={fallbackCronId} />
        </ActionSheet.ContentBlock>
      </ActionSheet.ScrollableContent>
    </ActionSheet>
  );
}

export function AgentCronDetailScreenView({
  cron,
  fallbackCronId,
  onBackPress,
}: {
  cron?: AgentCron | null;
  fallbackCronId?: string;
  onBackPress: () => void;
}) {
  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        title="Scheduled task"
        leftControls={<ScreenHeader.BackButton onPress={onBackPress} />}
        borderBottom
      />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
        }}
      >
        <YStack padding="$xl">
          <DetailPanel>
            <AgentCronDetailContent
              cron={cron}
              fallbackCronId={fallbackCronId}
            />
          </DetailPanel>
        </YStack>
      </ScrollView>
    </View>
  );
}

export function AgentCronDetailContent({
  cron,
  fallbackCronId,
}: {
  cron?: AgentCron | null;
  fallbackCronId?: string;
}) {
  const title = cron?.title || 'Recurring task';
  const scheduleSummary = cron
    ? formatSchedule(cron.schedule)
    : fallbackCronId
      ? `Cron ${fallbackCronId}`
      : 'Syncing...';

  return (
    <YStack gap="$xl">
      <YStack gap="$xs">
        <DetailLabel>Task</DetailLabel>
        <DetailValue>{title}</DetailValue>
      </YStack>
      <DetailRow label="Schedule" value={scheduleSummary} />
      <YStack gap="$xs">
        <DetailLabel>Status</DetailLabel>
        <Badge
          alignSelf="flex-start"
          text={formatStatus(cron?.status)}
          type={statusBadgeType(cron?.status)}
        />
      </YStack>
      <DetailRow
        label="Last run"
        value={cron?.lastFiredAt ? formatDateTime(cron.lastFiredAt) : 'Never'}
      />
      <DetailRow
        label="Created"
        value={cron?.createdAt ? formatDateTime(cron.createdAt) : 'Syncing...'}
      />
      <DetailRow label="Target" value={formatTarget(cron?.target)} />
      <DetailRow label="Tools" value={formatToolPolicy(cron?.toolPolicy)} />
      <YStack gap="$m" paddingTop="$xl">
        <DetailLabel>Prompt</DetailLabel>
        <PromptText>{cron?.prompt ?? 'Syncing...'}</PromptText>
      </YStack>
    </YStack>
  );
}

export function ScheduledTasksList({
  crons,
  onPressCron,
  ...props
}: {
  crons: AgentCron[];
  onPressCron: (cron: AgentCron) => void;
} & ComponentProps<typeof YStack>) {
  if (!crons.length) {
    return (
      <EmptyState flex={1} alignItems="center" justifyContent="center">
        <Icon type="Clock" color="$tertiaryText" size="$xl" />
        <YStack gap="$xs" alignItems="center">
          <Text size="$label/l">No scheduled tasks</Text>
          <Text color="$tertiaryText" size="$label/m">
            New recurring tasks will appear here.
          </Text>
        </YStack>
      </EmptyState>
    );
  }

  return (
    <ScrollView flex={1}>
      <YStack gap="$s" {...props}>
        {crons.map((cron) => (
          <ScheduledTaskListItem
            key={cron.id}
            cron={cron}
            onPress={onPressCron}
          />
        ))}
      </YStack>
    </ScrollView>
  );
}

export function formatSchedule(schedule: api.AgentCronSchedule) {
  if (schedule.kind === 'once') {
    return `Once at ${formatDateTime(schedule.next)}`;
  }

  return `Every ${formatDuration(schedule.every)}, next at ${formatDateTime(
    schedule.next
  )}`;
}

function ScheduledTaskListItem({
  cron,
  onPress,
}: {
  cron: AgentCron;
  onPress: (cron: AgentCron) => void;
}) {
  return (
    <Pressable
      borderRadius="$xl"
      onPress={() => onPress(cron)}
      pressStyle={{ backgroundColor: '$secondaryBackground' }}
      accessibilityRole="button"
      accessibilityLabel={`View scheduled task ${cron.title ?? cron.id}`}
    >
      <ListItem backgroundColor="$background" borderRadius="$xl">
        <ListItem.SystemIcon icon="Clock" rounded />
        <ListItem.MainContent>
          <ListItem.Title>{cron.title || 'Recurring task'}</ListItem.Title>
          <ListItem.Subtitle>{formatSchedule(cron.schedule)}</ListItem.Subtitle>
        </ListItem.MainContent>
        <ListItem.EndContent>
          <XStack alignItems="center" gap="$s">
            <Badge
              size="micro"
              text={formatStatus(cron.status)}
              type={statusBadgeType(cron.status)}
            />
            <Icon type="ChevronRight" color="$tertiaryText" size="$s" />
          </XStack>
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <YStack gap="$xs">
      <DetailLabel>{label}</DetailLabel>
      <DetailValue>{value}</DetailValue>
    </YStack>
  );
}

function formatStatus(status?: api.AgentCronStatus) {
  if (status === 'active') {
    return 'Active';
  }

  if (status === 'paused') {
    return 'Paused';
  }

  if (status === 'cancelled') {
    return 'Cancelled';
  }

  return 'Syncing...';
}

function statusBadgeType(status?: api.AgentCronStatus): BadgeType {
  if (status === 'active') {
    return 'positive';
  }

  if (status === 'paused') {
    return 'warning';
  }

  return 'neutral';
}

function formatTarget(target?: api.AgentCronTarget) {
  if (!target) {
    return 'Syncing...';
  }

  if (target.kind === 'delegated-dm') {
    return `DM via ${target.moon}`;
  }

  return 'None';
}

function formatToolPolicy(policy?: api.AgentCronToolPolicy) {
  if (!policy) {
    return 'Syncing...';
  }

  if (policy.kind === 'all') {
    return 'All tools';
  }

  if (policy.kind === 'none') {
    return 'No tools';
  }

  return policy.tools.length ? policy.tools.join(', ') : 'No tools';
}

function formatDateTime(value: number) {
  const date = new Date(value);
  return `${makePrettyShortDate(date)} at ${makePrettyTime(date)}`;
}

function formatDuration(value: number) {
  const seconds = Math.round(value / 1000);
  if (seconds < 60) {
    return pluralize(seconds, 'second');
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return pluralize(minutes, 'minute');
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return pluralize(hours, 'hour');
  }

  const days = Math.round(hours / 24);
  return pluralize(days, 'day');
}

function pluralize(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

const DetailPanel = styled(YStack, {
  backgroundColor: '$background',
  borderRadius: '$2xl',
  padding: '$2xl',
});

const DetailLabel = styled(Text, {
  color: '$tertiaryText',
  size: '$label/s',
  textTransform: 'uppercase',
});

const DetailValue = styled(Text, {
  color: '$primaryText',
  size: '$label/l',
});

const PromptText = styled(Text, {
  color: '$primaryText',
  size: '$body',
  trimmed: false,
});

const EmptyState = styled(YStack, {
  padding: '$3xl',
  gap: '$l',
});
