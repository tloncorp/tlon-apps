import { Picker } from '@react-native-picker/picker';
import type * as db from '@tloncorp/shared/db';
import { Button, Icon, Text, desktopTypeStyles } from '@tloncorp/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Platform, type TextStyle } from 'react-native';
import { XStack, getConfig, getTokenValue, useTheme } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { InputFrame } from './Form';
import type { ForwardChannelChat } from './ForwardChannelSelector';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { SettingsListScreenView } from './SettingsList';
import type {
  AutomationTaskDraft,
  AutomationTaskStatus,
} from './automationTaskDraft';
import {
  type IdentifiedAutomationTask,
  type TaskRunsEntry,
  type TimeSelection,
  fromTimeSelection,
  scheduledTaskListSections,
  taskEditorSections,
  toTimeSelection,
} from './scheduledTaskSections';
import { useForwardToChannelSheet } from './useForwardToChannelSheet';

export type { IdentifiedAutomationTask } from './scheduledTaskSections';

// On a wide window these screens keep to the column a profile uses.
const COLUMN_WIDTH = 600;

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
      maxWidth={COLUMN_WIDTH}
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
      maxWidth={COLUMN_WIDTH}
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
  runs,
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
  /** A saved task's run history and test run. */
  runs?: TaskRunsEntry;
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
        runs,
        onDelete,
        deleting,
      })}
      onBackPressed={onBack}
      showsBackOnWideWindows
      maxWidth={COLUMN_WIDTH}
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

  const isWeb = Platform.OS === 'web';
  const done = () => {
    onChange(selection);
    onOpenChange(false);
  };
  const columns = (
    <>
      <TimeColumn
        label="Hour"
        value={selection.hour}
        onValueChange={(next) =>
          setSelection((current) => ({ ...current, hour: Number(next) }))
        }
      >
        {HOURS.map((option) => (
          <Picker.Item key={option} label={`${option}`} value={option} />
        ))}
      </TimeColumn>
      {isWeb ? (
        <Text size="$label/xl" aria-hidden>
          :
        </Text>
      ) : null}
      <TimeColumn
        label="Minute"
        value={selection.minute}
        onValueChange={(next) =>
          setSelection((current) => ({ ...current, minute: Number(next) }))
        }
      >
        {MINUTES.map((option) => (
          <Picker.Item
            key={option}
            label={option.toString().padStart(2, '0')}
            value={option}
          />
        ))}
      </TimeColumn>
      <TimeColumn
        label="AM or PM"
        value={selection.period}
        onValueChange={(next) =>
          setSelection((current) => ({
            ...current,
            period: next as TimeSelection['period'],
          }))
        }
      >
        <Picker.Item label="AM" value="AM" />
        <Picker.Item label="PM" value="PM" />
      </TimeColumn>
    </>
  );

  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dialogContentProps={isWeb ? { width: 420 } : undefined}
    >
      <ActionSheet.SimpleHeader title="Time" />
      {isWeb ? (
        <ActionSheet.Content>
          <ActionSheet.FormBlock>
            <XStack alignItems="center" gap="$s">
              {columns}
            </XStack>
          </ActionSheet.FormBlock>
          <ActionSheet.FormBlock>
            <XStack alignItems="center" gap="$m" justifyContent="flex-end">
              <Button
                label="Cancel"
                preset="minimal"
                onPress={() => onOpenChange(false)}
              />
              <Button label="Done" preset="primary" onPress={done} />
            </XStack>
          </ActionSheet.FormBlock>
        </ActionSheet.Content>
      ) : (
        <ActionSheet.Content paddingHorizontal="$xl" paddingBottom="$2xl">
          <XStack height={190} alignItems="center">
            {columns}
          </XStack>
          <Button preset="primary" label="Done" centered onPress={done} />
        </ActionSheet.Content>
      )}
    </ActionSheet>
  );
}

type TimeColumnProps = {
  label: string;
  value: string | number;
  onValueChange: (value: string | number) => void;
  children: ReactNode;
};

/**
 * One part of the time. Natively a wheel; on web the picker is a bare
 * `<select>`, so it is drawn in a text field's frame with its own chevron
 * rather than left to each browser's styling.
 */
function TimeColumn(props: TimeColumnProps) {
  return Platform.OS === 'web' ? (
    <WebTimeColumn {...props} />
  ) : (
    <Picker
      accessibilityLabel={props.label}
      selectedValue={props.value}
      onValueChange={props.onValueChange}
      style={{ flex: 1 }}
    >
      {props.children}
    </Picker>
  );
}

// Drops the browser's own select arrow and focus ring. React Native's style
// types do not list these CSS properties; react-native-web passes them on.
const bareSelectStyle = {
  appearance: 'none',
  outlineStyle: 'none',
} as unknown as TextStyle;

function WebTimeColumn({
  label,
  value,
  onValueChange,
  children,
}: TimeColumnProps) {
  const theme = useTheme();
  // The frame clips the select's own focus ring, so the frame shows focus.
  const [focused, setFocused] = useState(false);
  return (
    <InputFrame
      flex={1}
      position="relative"
      paddingLeft={0}
      paddingRight={0}
      borderColor={focused ? '$positiveActionText' : '$border'}
    >
      <Picker
        accessibilityLabel={label}
        selectedValue={value}
        onValueChange={onValueChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            flex: 1,
            alignSelf: 'stretch',
            borderWidth: 0,
            // The open list of options takes these too, so it follows the app's
            // theme rather than the system's.
            backgroundColor: theme.background.val,
            color: theme.primaryText.val,
            fontFamily: String(getConfig().fonts.body?.family),
            fontSize: desktopTypeStyles['$label/xl'].fontSize,
            paddingLeft: getTokenValue('$xl', 'space'),
            // Clears the chevron.
            paddingRight: 36,
            cursor: 'pointer',
          },
          bareSelectStyle,
        ]}
      >
        {children}
      </Picker>
      <Icon
        type="ChevronDown"
        size="$s"
        color="$tertiaryText"
        position="absolute"
        right="$l"
        pointerEvents="none"
      />
    </InputFrame>
  );
}
