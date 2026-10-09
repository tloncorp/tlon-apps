import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ConfirmDialog, useToast } from '@tloncorp/ui';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useFullGroupRosters } from '../../hooks/useFullGroupRosters';
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
  destinationForChannel,
  draftFromTask,
  firstDestinationIn,
  groupsMissingBot,
  newTaskDraft,
  taskStatus,
  validateDraft,
} from '../../ui/components/automationTaskDraft';
import { formatAutomationSchedule } from '../../ui/components/formatAutomationSchedule';
import { useContact } from '../../ui/contexts/appDataContext';
import { useBotDelivery } from './useBotDelivery';
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

/**
 * Desktop navigators keep this screen mounted and hand it the next task as
 * new params, so the editor is keyed by its task: one task's unsaved edits
 * must never be laid over another.
 */
export function ScheduledTaskEditorScreen(props: Props) {
  const { botShip, taskId, groupId, channelId } = props.route.params;
  return (
    <TaskEditor
      key={`${botShip}/${taskId ?? ''}/${groupId ?? ''}/${channelId ?? ''}`}
      {...props}
    />
  );
}

function TaskEditor({ navigation, route }: Props) {
  const { botShip, taskId, groupId, channelId } = route.params;
  const currentUserId = useCurrentUserId();
  const showToast = useToast();
  const actions = useAutomationTaskActions(botShip);
  const query = useStewardAutomationTasks();
  const { refetch } = query;

  // Deleting removes the task from the mirror before the screen has gone
  // back; keep showing the copy being deleted rather than a "not found"
  // notice.
  const [busy, setBusy] = useState<'save' | 'delete' | 'status' | null>(null);
  const [deleting, setDeleting] = useState<StewardAutomationTask>();
  const task =
    (taskId ? tasksForShip(query.data, botShip)?.[taskId] : undefined) ??
    deleting;

  // A channel is offered only when the bot may write in it.
  const { delivery, known: deliveryKnown } = useBotDelivery(botShip);
  // A task started from a channel's list posts to that channel, and one
  // started from a group's list to that group's first chat. Where the bot
  // cannot write there, it is the next best place in the same group.
  const { data: startGroup } = store.useGroup({
    id: taskId ? undefined : groupId,
  });
  const groupDestination = useMemo(
    () => firstDestinationIn(startGroup?.channels ?? [], delivery, channelId),
    [startGroup?.channels, delivery, channelId]
  );

  const savedDraft = useMemo(
    () =>
      task
        ? draftFromTask(task)
        : newTaskDraft(currentUserId, groupDestination),
    [task, currentUserId, groupDestination]
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
  // The same mounted screen can be shown again for the same task, or for
  // another new one. Each visit starts clean: nothing left over from a
  // draft that was abandoned, created or deleted on the last one.
  //
  // An edit can outlast its visit: the bot can take a while to answer, and
  // the person can go back meanwhile and even come in again. What an edit
  // does to the screen once it is answered belongs to the visit that made
  // it, so each edit checks that visit is still the one on screen.
  const visit = useRef(0);
  const startEdit = useCallback(() => {
    const during = visit.current;
    return { onScreen: () => visit.current === during };
  }, []);
  useFocusEffect(
    useCallback(() => {
      visit.current += 1;
      setEdits({});
      setBusy(null);
      setDeleting(undefined);
      setRequestedEnabled(null);
      refetchAutomationsOnFocus(refetch);
      return () => {
        visit.current += 1;
      };
    }, [refetch])
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
    const problem = validateDraft(draft, {
      isNew: !taskId,
      named: Boolean(task?.name?.trim()),
    });
    if (problem) {
      showToast({ message: problem });
      return;
    }
    const edit = startEdit();
    setBusy('save');
    try {
      if (!taskId) {
        await actions.create(
          buildTaskCreate(draft, { timezone: deviceTimezone() })
        );
        if (edit.onScreen()) navigation.goBack();
        return;
      }
      if (patch) await actions.update(taskId, patch);
      if (edit.onScreen()) setEdits({});
      showToast({ message: 'Saved', duration: 1500 });
    } catch (error) {
      report(error);
    } finally {
      if (edit.onScreen()) setBusy(null);
    }
  }, [actions, draft, navigation, patch, report, showToast, startEdit, taskId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!taskId) return;
      const edit = startEdit();
      setRequestedEnabled(enabled);
      setBusy('status');
      try {
        await actions.update(taskId, { enabled });
      } catch (error) {
        report(error);
      } finally {
        if (edit.onScreen()) {
          setRequestedEnabled(null);
          setBusy(null);
        }
      }
    },
    [actions, report, startEdit, taskId]
  );

  const remove = useCallback(async () => {
    if (!taskId) return;
    const edit = startEdit();
    setBusy('delete');
    setDeleting(task);
    try {
      await actions.remove(taskId);
      if (edit.onScreen()) navigation.goBack();
    } catch (error) {
      report(error);
      if (edit.onScreen()) {
        setDeleting(undefined);
        setBusy(null);
      }
    }
  }, [actions, navigation, report, startEdit, task, taskId]);

  const destinationFilter = useCallback(
    (channel: db.Channel) => destinationForChannel(channel, delivery) !== null,
    [delivery]
  );
  // That copy holds only 15 members of a larger group until the full list
  // is fetched, so the bot can be missing from a group it is in. Once the
  // picker is opened, fetch the lists of the groups it leaves out; their
  // channels appear as the bot's seat turns up.
  const [pickingDestination, setPickingDestination] = useState(false);
  const { data: chats } = store.useCurrentChats({
    enabled: pickingDestination,
  });
  const groupsToCheck = useMemo(
    () =>
      deliveryKnown
        ? groupsMissingBot(
            [...(chats?.pinned ?? []), ...(chats?.unpinned ?? [])].flatMap(
              (chat) => (chat.type === 'channel' ? [chat.channel] : [])
            ),
            delivery.botGroupIds
          )
        : [],
    [chats, delivery.botGroupIds, deliveryKnown]
  );
  useFullGroupRosters(groupsToCheck);
  const openDestinations = useCallback(() => setPickingDestination(true), []);
  const selectDestination = useCallback(
    (channel: db.Channel) => {
      const destination = destinationForChannel(channel, delivery);
      // The picker holds its list still while it is open, so it can show a
      // channel the bot has lost since.
      if (!destination) {
        showToast({ message: 'Your bot can no longer post there.' });
        return;
      }
      changeDraft({ ...draft, destination });
    },
    [changeDraft, delivery, draft, showToast]
  );

  if (query.isLoading) {
    return (
      <ScheduledTasksNotice
        title="Loading scheduled task"
        body="Getting your bot's tasks."
        loading
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
        onOpenDestinations={openDestinations}
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
