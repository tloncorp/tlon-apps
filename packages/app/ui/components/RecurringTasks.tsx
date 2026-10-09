import { Picker } from '@react-native-picker/picker';
import type * as db from '@tloncorp/shared/db';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { XStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import type { ForwardChannelChat } from './ForwardChannelSelector';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { SettingsListScreenView } from './SettingsList';
import type {
  AutomationTaskDraft,
  AutomationTaskStatus,
} from './automationTaskDraft';
import {
  type IdentifiedAutomationTask,
  type TimeSelection,
  fromTimeSelection,
  scheduledTaskListSections,
  taskEditorSections,
  toTimeSelection,
} from './scheduledTaskSections';
import { useForwardToChannelSheet } from './useForwardToChannelSheet';

export type { IdentifiedAutomationTask } from './scheduledTaskSections';

export function ScheduledTasksScreenView({
  available,
  synced = true,
  error = false,
  loading = false,
  tasks,
  scope,
  onAddTask,
  onBack,
  onPressTask,
  onRetry,
}: {
  available: boolean;
  synced?: boolean;
  error?: boolean;
  loading?: boolean;
  tasks: IdentifiedAutomationTask[];
  /** The group the list is narrowed to, when it is. */
  scope?: string;
  onAddTask?: () => void;
  onBack: () => void;
  onPressTask?: (task: IdentifiedAutomationTask) => void;
  onRetry?: () => void;
}) {
  const ready = !loading && !error && available && synced;
  return (
    <SettingsListScreenView
      title="Scheduled tasks"
      loading={loading}
      sections={scheduledTaskListSections({
        available,
        synced,
        error,
        tasks,
        scope,
        onAddTask,
        onPressTask,
        onRetry,
      })}
      onBackPressed={onBack}
      // Reached from a profile as well as from Settings, so a wide window
      // has nothing beside it to go back to.
      showsBackOnWideWindows
      rightActions={[
        {
          id: 'new-scheduled-task',
          icon: 'Add',
          label: 'New task',
          onPress: onAddTask,
          visible: ready && Boolean(onAddTask),
        },
      ]}
    />
  );
}

/** A task screen with nothing to edit: still loading, or the reason why not. */
export function ScheduledTasksNotice({
  title,
  body,
  action,
  loading = false,
  onBack,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  loading?: boolean;
  onBack: () => void;
}) {
  return (
    <SettingsListScreenView
      title="Scheduled task"
      loading={loading}
      sections={[
        {
          key: 'notice',
          title: action ? title : undefined,
          footer: body,
          rows: [
            action
              ? {
                  key: 'action',
                  title: action.label,
                  action: true,
                  onPress: action.onPress,
                }
              : { key: 'notice', title },
          ],
        },
      ]}
      onBackPressed={onBack}
      showsBackOnWideWindows
    />
  );
}

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

export function RecurringTaskEditorView({
  title,
  draft,
  onChange,
  onBack,
  disabled = false,
  notice,
  promptEditable = true,
  scheduleLabel,
  timezone,
  destinationLabel,
  onSelectDestination,
  onOpenDestinations,
  destinationFilter,
  destinationChannelChats,
  status,
  save,
  onDelete,
  deleting = false,
}: {
  title: string;
  draft: AutomationTaskDraft;
  onChange: (draft: AutomationTaskDraft) => void;
  onBack: () => void;
  /** Locks every control, for a task that must not be edited right now. */
  disabled?: boolean;
  /** Why the task is locked. */
  notice?: string;
  promptEditable?: boolean;
  /** Shown in place of the day and time rows when `draft.schedule` is null. */
  scheduleLabel?: string;
  timezone?: string;
  destinationLabel: string;
  onSelectDestination?: (channel: db.Channel) => void;
  /** Called each time the destination picker is opened. */
  onOpenDestinations?: () => void;
  destinationFilter?: (channel: db.Channel) => boolean;
  destinationChannelChats?: ForwardChannelChat[];
  /** Pause and resume for a task that already exists. */
  status?: {
    value: AutomationTaskStatus;
    busy: boolean;
    onChange: (enabled: boolean) => void;
  };
  save: {
    label: string;
    disabled: boolean;
    busy: boolean;
    onPress: () => void;
  };
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  const schedule = draft.schedule;

  const selectDestination = useCallback(
    async (channel: db.Channel) => onSelectDestination?.(channel),
    [onSelectDestination]
  );
  const {
    handleChannelSelected,
    renderFooter: renderDestinationFooter,
    onNativeDismissed: onDestinationSheetDismissed,
    keepMounted: keepDestinationSheetMounted,
    presentationKey: destinationSheetKey,
  } = useForwardToChannelSheet({
    isOpen: destinationSheetOpen,
    onClose: () => setDestinationSheetOpen(false),
    onForwardToChannel: selectDestination,
    successMessage: () => null,
    failureMessage: 'Could not select channel',
    submitLabel: (channelTitle) => `Post to ${channelTitle}`,
    submittingLabel: 'Selecting...',
  });

  return (
    <SettingsListScreenView
      title={title}
      sections={taskEditorSections({
        draft,
        onChange,
        disabled,
        notice,
        promptEditable,
        scheduleLabel,
        timezone,
        destinationLabel,
        onPressTime: () => setTimeSheetOpen(true),
        onPressDestination: onSelectDestination
          ? () => {
              onOpenDestinations?.();
              setDestinationSheetOpen(true);
            }
          : undefined,
        status,
        onDelete,
        deleting,
      })}
      onBackPressed={onBack}
      showsBackOnWideWindows
      rightActions={[
        {
          id: 'save-scheduled-task',
          text: save.busy ? 'Saving…' : save.label,
          onPress: save.onPress,
          disabled: save.disabled || save.busy,
        },
      ]}
    >
      {schedule ? (
        <TimePickerSheet
          open={timeSheetOpen}
          onOpenChange={setTimeSheetOpen}
          value={toTimeSelection(schedule)}
          onChange={(time) =>
            onChange({
              ...draft,
              schedule: { ...schedule, ...fromTimeSelection(time) },
            })
          }
        />
      ) : null}
      <ForwardToChannelSheet
        key={destinationSheetKey}
        open={destinationSheetOpen}
        onOpenChange={setDestinationSheetOpen}
        onNativeDismissed={onDestinationSheetDismissed}
        keepMounted={keepDestinationSheetMounted}
        title="Posts to"
        onChannelSelected={handleChannelSelected}
        channelFilter={destinationFilter}
        channelChats={destinationChannelChats}
        footerComponent={renderDestinationFooter}
        allowNotebooks
      />
    </SettingsListScreenView>
  );
}

function TimePickerSheet({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TimeSelection;
  onChange: (value: TimeSelection) => void;
}) {
  const [selection, setSelection] = useState(value);
  const { hour, minute, period } = value;

  useEffect(() => {
    if (open) {
      setSelection({ hour, minute, period });
    }
  }, [open, hour, minute, period]);

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange} modal>
      <ActionSheet.SimpleHeader title="Time" />
      <ActionSheet.Content paddingHorizontal="$xl" paddingBottom="$2xl">
        <XStack height={190} alignItems="center">
          <Picker
            accessibilityLabel="Hour"
            selectedValue={selection.hour}
            onValueChange={(next) =>
              setSelection((current) => ({ ...current, hour: Number(next) }))
            }
            style={{ flex: 1 }}
          >
            {HOURS.map((option) => (
              <Picker.Item key={option} label={`${option}`} value={option} />
            ))}
          </Picker>
          <Picker
            accessibilityLabel="Minute"
            selectedValue={selection.minute}
            onValueChange={(next) =>
              setSelection((current) => ({
                ...current,
                minute: Number(next),
              }))
            }
            style={{ flex: 1 }}
          >
            {MINUTES.map((option) => (
              <Picker.Item
                key={option}
                label={option.toString().padStart(2, '0')}
                value={option}
              />
            ))}
          </Picker>
          <Picker
            accessibilityLabel="AM or PM"
            selectedValue={selection.period}
            onValueChange={(next) =>
              setSelection((current) => ({
                ...current,
                period: next as TimeSelection['period'],
              }))
            }
            style={{ flex: 1 }}
          >
            <Picker.Item label="AM" value="AM" />
            <Picker.Item label="PM" value="PM" />
          </Picker>
        </XStack>
        <Button
          preset="primary"
          label="Done"
          centered
          onPress={() => {
            onChange(selection);
            onOpenChange(false);
          }}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
