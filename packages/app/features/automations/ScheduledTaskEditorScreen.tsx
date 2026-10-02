import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ConfirmDialog, useToast } from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import type { RootStackParamList } from '../../navigation/types';
import {
  RecurringTaskEditorView,
  ScheduledTasksNotice,
} from '../../ui/components/RecurringTasks';
import {
  type AutomationDestination,
  type AutomationTaskDraft,
  buildTaskCreate,
  buildTaskUpdate,
  canEditPrompt,
  describeAutomationError,
  draftFromTask,
  newTaskDraft,
  taskStatus,
  validateDraft,
} from '../../ui/components/automationTaskDraft';
import { formatAutomationSchedule } from '../../ui/components/formatAutomationSchedule';
import { useContact } from '../../ui/contexts/appDataContext';
import {
  refetchAutomationsOnFocus,
  tasksForShip,
  useAutomationTaskActions,
  useStewardAutomationTasks,
} from './useStewardAutomationTasks';

type Props = NativeStackScreenProps<RootStackParamList, 'ScheduledTaskEditor'>;

const HOLD_NOTICE =
  'This task is paused while your credits are limited. It starts again on its own when credits return. Changing it now would stop that.';

function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function useDestinationLabel(
  destination: AutomationDestination,
  currentUserId: string
) {
  const channel = store.useChannel({
    id: destination.kind === 'channel' ? destination.nest : undefined,
  }).data;
  const contact = useContact(destination.kind === 'dm' ? destination.ship : '');
  switch (destination.kind) {
    case 'none':
      return 'Nowhere';
    case 'other':
      return destination.label;
    case 'dm':
      return destination.ship === currentUserId
        ? 'Direct message to you'
        : `Direct message to ${contact?.nickname || destination.ship}`;
    case 'channel':
      return (
        [channel?.group?.title, channel?.title].filter(Boolean).join(' · ') ||
        destination.nest
      );
  }
}

export function ScheduledTaskEditorScreen({ navigation, route }: Props) {
  const { botShip, taskId } = route.params;
  const currentUserId = useCurrentUserId();
  const showToast = useToast();
  const actions = useAutomationTaskActions(botShip);
  const query = useStewardAutomationTasks();
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => refetchAutomationsOnFocus(refetch), [refetch])
  );

  // Deleting removes the task from the mirror before the screen has gone
  // back; keep showing the copy being deleted rather than a "not found"
  // notice.
  const [busy, setBusy] = useState<'save' | 'delete' | 'status' | null>(null);
  const [deleting, setDeleting] = useState<StewardAutomationTask>();
  const task =
    (taskId ? tasksForShip(query.data, botShip)?.[taskId] : undefined) ??
    deleting;

  const savedDraft = useMemo(
    () => (task ? draftFromTask(task) : newTaskDraft(currentUserId)),
    [task, currentUserId]
  );
  // Only the fields the person changed, laid over the mirrored task. If the
  // bot changes the task mid-edit, the rest follows it and stays out of the
  // patch; a field put back to its saved value counts as unchanged again.
  const [edits, setEdits] = useState<Partial<AutomationTaskDraft>>({});
  const draft = useMemo(
    () => ({ ...savedDraft, ...edits }),
    [savedDraft, edits]
  );
  const changeDraft = useCallback(
    (next: AutomationTaskDraft) =>
      setEdits((current) => {
        const changed: Partial<AutomationTaskDraft> = { ...current };
        for (const key of Object.keys(next) as (keyof AutomationTaskDraft)[]) {
          if (next[key] === draft[key]) continue;
          if (JSON.stringify(next[key]) === JSON.stringify(savedDraft[key])) {
            delete changed[key];
          } else {
            Object.assign(changed, { [key]: next[key] });
          }
        }
        return changed;
      }),
    [draft, savedDraft]
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [requestedEnabled, setRequestedEnabled] = useState<boolean | null>(
    null
  );
  const destinationLabel = useDestinationLabel(
    draft.destination,
    currentUserId
  );
  const patch = task ? buildTaskUpdate(task, draft) : null;

  const report = useCallback(
    (error: unknown) =>
      showToast({ message: describeAutomationError(error), duration: 4000 }),
    [showToast]
  );

  const save = useCallback(async () => {
    const problem = validateDraft(draft, { isNew: !taskId });
    if (problem) {
      showToast({ message: problem });
      return;
    }
    setBusy('save');
    try {
      if (!taskId) {
        await actions.create(
          buildTaskCreate(draft, { timezone: deviceTimezone() })
        );
        navigation.goBack();
        return;
      }
      if (patch) await actions.update(taskId, patch);
      setEdits({});
      showToast({ message: 'Saved', duration: 1500 });
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  }, [actions, draft, navigation, patch, report, showToast, taskId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!taskId) return;
      setRequestedEnabled(enabled);
      setBusy('status');
      try {
        await actions.update(taskId, { enabled });
      } catch (error) {
        report(error);
      } finally {
        setRequestedEnabled(null);
        setBusy(null);
      }
    },
    [actions, report, taskId]
  );

  const remove = useCallback(async () => {
    if (!taskId) return;
    setBusy('delete');
    setDeleting(task);
    try {
      await actions.remove(taskId);
      navigation.goBack();
    } catch (error) {
      report(error);
      setDeleting(undefined);
      setBusy(null);
    }
  }, [actions, navigation, report, task, taskId]);

  // The bot delivers into its own DM with the owner or a channel it can post
  // in; a group's member list is the only local sign of the second.
  const destinationFilter = useCallback(
    (channel: db.Channel) => {
      if (channel.type === 'dm') return channel.id === botShip;
      if (channel.type === 'groupDm') return false;
      const members = channel.group?.members;
      return (
        !members?.length ||
        members.some((member) => member.contactId === botShip)
      );
    },
    [botShip]
  );
  const selectDestination = useCallback(
    (channel: db.Channel) =>
      changeDraft({
        ...draft,
        destination:
          channel.type === 'dm'
            ? { kind: 'dm', ship: currentUserId }
            : { kind: 'channel', nest: channel.id },
      }),
    [changeDraft, currentUserId, draft]
  );

  if (query.isLoading) {
    return (
      <ScheduledTasksNotice
        title="Loading scheduled task"
        body="Getting your bot's tasks."
        onBack={navigation.goBack}
      />
    );
  }

  if (query.isError && !query.data?.available) {
    return (
      <ScheduledTasksNotice
        title="Could not load scheduled task"
        body="Check your connection and try again."
        action={{ label: 'Try again', onPress: () => void refetch() }}
        onBack={navigation.goBack}
      />
    );
  }

  if (!query.data?.available) {
    return (
      <ScheduledTasksNotice
        title="Scheduled tasks unavailable"
        body="Your node needs an update before it can show scheduled tasks."
        onBack={navigation.goBack}
      />
    );
  }

  if (tasksForShip(query.data, botShip) === undefined) {
    return (
      <ScheduledTasksNotice
        title="Scheduled tasks not synced"
        body="Your bot has not shared its tasks yet. This can take a moment after it starts."
        action={{ label: 'Refresh', onPress: () => void refetch() }}
        onBack={navigation.goBack}
      />
    );
  }

  if (taskId && !task) {
    return (
      <ScheduledTasksNotice
        title="Scheduled task not found"
        body="This task may have been removed since the list was loaded."
        action={{ label: 'Refresh', onPress: () => void refetch() }}
        onBack={navigation.goBack}
      />
    );
  }

  const status = task ? taskStatus(task) : undefined;
  const held = status === 'held';
  const schedule = task?.schedule?.kind === 'cron' ? task.schedule : undefined;

  return (
    <>
      <RecurringTaskEditorView
        title={task ? 'Scheduled task' : 'New task'}
        draft={draft}
        onChange={changeDraft}
        onBack={navigation.goBack}
        disabled={held || busy === 'save' || busy === 'delete'}
        notice={held ? HOLD_NOTICE : undefined}
        promptEditable={!task || canEditPrompt(task)}
        scheduleLabel={task ? formatAutomationSchedule(task) : undefined}
        timezone={task ? schedule?.tz : deviceTimezone()}
        destinationLabel={destinationLabel}
        onSelectDestination={selectDestination}
        destinationFilter={destinationFilter}
        status={
          status
            ? {
                value:
                  requestedEnabled === null || held
                    ? status
                    : requestedEnabled
                      ? 'active'
                      : 'paused',
                busy: busy !== null,
                onChange: setEnabled,
              }
            : undefined
        }
        save={{
          label: task ? 'Save' : 'Create',
          disabled: held || busy !== null || (Boolean(task) && !patch),
          busy: busy === 'save',
          onPress: save,
        }}
        onDelete={task ? () => setConfirmingDelete(true) : undefined}
        deleting={busy === 'delete'}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this task?"
        description="Your bot will stop running it. This cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}
