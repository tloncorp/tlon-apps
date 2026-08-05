import * as db from '@tloncorp/shared/db';
import { syncCron } from '@tloncorp/shared/store';
import { Icon, Pressable, Text } from '@tloncorp/ui';
import { useEffect, useMemo, useState } from 'react';
import { XStack, YStack, styled } from 'tamagui';

import { AgentCronDetailSheet } from '../AgentCronDetail';

type RecurringTaskNoticeData = {
  cronId: string;
};

const NOTICE_TYPES = new Set([
  'agent-cron-notice',
  'agentCronNotice',
  'recurring-task-scheduled',
  'recurringTaskScheduled',
]);

export function getRecurringTaskNotice(
  post: db.Post
): RecurringTaskNoticeData | null {
  if (post.type !== 'notice') {
    return null;
  }

  return (
    findRecurringTaskNotice(readJsonValue(post.content)) ??
    findRecurringTaskNotice(readJsonValue(post.blob))
  );
}

export function RecurringTaskNotice({
  notice,
}: {
  notice: RecurringTaskNoticeData;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const cronState = db.agentCronState.useValue();
  const cron = useMemo(
    () => cronState.crons.find((candidate) => candidate.id === notice.cronId),
    [cronState.crons, notice.cronId]
  );

  const title = cron?.title || 'Recurring task scheduled';

  useEffect(() => {
    if (!isOpen || cron) {
      return;
    }

    syncCron().catch((error) => {
      console.warn('Failed to sync agent cron details', error);
    });
  }, [cron, isOpen]);

  return (
    <>
      <NoticePressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="View recurring task"
      >
        <NoticeFrame>
          <XStack gap="$m" alignItems="center">
            <Icon type="Clock" size="$m" color="$systemNoticeText" />
            <YStack flex={1} gap="$2xs">
              <NoticeTitle>Recurring task scheduled</NoticeTitle>
              <NoticeBody numberOfLines={2}>{title}</NoticeBody>
            </YStack>
          </XStack>
        </NoticeFrame>
      </NoticePressable>

      <AgentCronDetailSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        cron={cron}
        fallbackCronId={notice.cronId}
        title="Recurring task scheduled"
      />
    </>
  );
}

function readJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function findRecurringTaskNotice(
  value: unknown
): RecurringTaskNoticeData | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findRecurringTaskNotice(item);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record.type ?? record.kind;
  const cronId =
    record.cronId ??
    record.cronID ??
    record.agentCronId ??
    record.cron ??
    record.id;

  if (
    typeof cronId === 'string' &&
    ((typeof type === 'string' && NOTICE_TYPES.has(type)) ||
      record.recurringTaskScheduled === true ||
      record.agentCronNotice === true)
  ) {
    return { cronId };
  }

  if (typeof type === 'string' && NOTICE_TYPES.has(type)) {
    if (typeof cronId === 'string') {
      return { cronId };
    }
  }

  for (const key of [
    'agentCronNotice',
    'recurringTaskScheduled',
    'recurring-task-scheduled',
  ]) {
    const nested = record[key];
    if (typeof nested === 'string') {
      return { cronId: nested };
    }
    if (nested && typeof nested === 'object') {
      const nestedCronId =
        (nested as Record<string, unknown>).cronId ??
        (nested as Record<string, unknown>).cronID ??
        (nested as Record<string, unknown>).agentCronId ??
        (nested as Record<string, unknown>).id;
      if (typeof nestedCronId === 'string') {
        return { cronId: nestedCronId };
      }
    }

    const result = findRecurringTaskNotice(record[key]);
    if (result) {
      return result;
    }
  }

  return null;
}

const NoticeFrame = styled(YStack, {
  backgroundColor: '$systemNoticeBackground',
  paddingHorizontal: '$xl',
  paddingVertical: '$2xl',
  borderRadius: '$l',
  borderWidth: 1,
  borderColor: '$systemNoticeBorder',
  minWidth: 280,
  maxWidth: 440,
});

const NoticePressable = styled(Pressable, {
  alignSelf: 'flex-start',
  marginLeft: '$5xl',
  marginRight: '$l',
  marginVertical: '$s',
  maxWidth: 440,
  cursor: 'pointer',
});

const NoticeTitle = styled(Text, {
  color: '$systemNoticeText',
  size: '$label/l',
  fontWeight: '600',
});

const NoticeBody = styled(Text, {
  color: '$systemNoticeText',
  opacity: 0.72,
  size: '$label/m',
});
