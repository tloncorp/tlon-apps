import { Picker } from '@react-native-picker/picker';
import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { TextInput } from './Form/inputs';
import type { ForwardChannelChat } from './ForwardChannelSelector';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { ScreenHeader } from './ScreenHeader';
import { SettingsContentScrollView } from './SettingsContentScrollView';
import {
  type AutomationTaskDraft,
  type AutomationTaskStatus,
  type EditableSchedule,
  taskPrompt,
  taskStatus,
  taskTitle,
} from './automationTaskDraft';
import { formatAutomationSchedule } from './formatAutomationSchedule';
import { useForwardToChannelSheet } from './useForwardToChannelSheet';

export interface IdentifiedAutomationTask {
  id: string;
  task: StewardAutomationTask;
}

const STATUS_LABELS: Record<AutomationTaskStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  held: 'Paused while credits are limited',
};

export function ScheduledTasksScreenView({
  available,
  synced = true,
  error,
  loading,
  tasks,
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
  onAddTask?: () => void;
  onBack: () => void;
  onPressTask?: (task: IdentifiedAutomationTask) => void;
  onRetry?: () => void;
}) {
  const ready = !loading && !error && available && synced;
  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        backAction={onBack}
        rightActions={[
          {
            id: 'new-scheduled-task',
            icon: 'Add',
            label: 'New task',
            onPress: onAddTask,
            visible: ready && Boolean(onAddTask),
          },
        ]}
        title="Scheduled"
        placement="navigation"
      />
      {loading ? (
        <ScheduledTasksNotice
          title="Loading scheduled tasks"
          body="Getting your bot's tasks."
        />
      ) : error ? (
        <ScheduledTasksNotice
          title="Could not load scheduled tasks"
          body="Check your connection and try again."
          action={
            onRetry ? { label: 'Try again', onPress: onRetry } : undefined
          }
        />
      ) : !available ? (
        <ScheduledTasksNotice
          title="Scheduled tasks unavailable"
          body="Your node needs an update before it can show scheduled tasks."
        />
      ) : !synced ? (
        <ScheduledTasksNotice
          title="Scheduled tasks not synced"
          body="Your bot has not shared its tasks yet. This can take a moment after it starts."
          action={onRetry ? { label: 'Refresh', onPress: onRetry } : undefined}
        />
      ) : tasks.length === 0 ? (
        <ScheduledTasksNotice
          title="No scheduled tasks"
          body="Add one here, or ask your bot to do something on a schedule."
          action={
            onAddTask ? { label: 'New task', onPress: onAddTask } : undefined
          }
        />
      ) : (
        <SettingsContentScrollView
          paddingHorizontal="$xl"
          paddingTop="$xl"
          safeAreaBottomOffset={24}
        >
          <YStack gap="$xl">
            {tasks.map((identified) => (
              <YStack
                key={identified.id}
                backgroundColor="$background"
                borderRadius="$2xl"
                overflow="hidden"
              >
                <ScheduledTaskListItem
                  identified={identified}
                  onPress={
                    onPressTask ? () => onPressTask(identified) : undefined
                  }
                />
              </YStack>
            ))}
          </YStack>
        </SettingsContentScrollView>
      )}
    </View>
  );
}

export function ScheduledTasksNotice({
  title,
  body,
  action,
  onBack,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  onBack?: () => void;
}) {
  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      {onBack ? (
        <ScreenHeader
          backgroundColor="$secondaryBackground"
          backAction={onBack}
          title="Scheduled"
          placement="navigation"
        />
      ) : null}
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$2xl"
        paddingHorizontal="$4xl"
        paddingBottom={96}
      >
        <Icon type="Clock" customSize={[32, 32]} color="$secondaryText" />
        <YStack alignItems="center" gap="$2xl" maxWidth={350}>
          <Text size="$label/2xl" fontWeight="600" textAlign="center">
            {title}
          </Text>
          <Text size="$label/l" color="$secondaryText" textAlign="center">
            {body}
          </Text>
        </YStack>
        {action ? (
          <Button
            preset="primary"
            label={action.label}
            onPress={action.onPress}
          />
        ) : null}
      </YStack>
    </View>
  );
}

function ScheduledTaskListItem({
  identified,
  onPress,
}: {
  identified: IdentifiedAutomationTask;
  onPress?: () => void;
}) {
  const { task } = identified;
  const prompt = taskPrompt(task);
  const status = taskStatus(task);
  const content = (
    <YStack padding="$2xl" gap="$2xl">
      <Text size="$label/2xl" fontWeight="600" numberOfLines={1}>
        {taskTitle(task)}
      </Text>
      {prompt ? (
        <Text size="$label/xl" color="$secondaryText" numberOfLines={3}>
          {prompt}
        </Text>
      ) : null}
      <Text size="$label/xl" color="$tertiaryText">
        {status === 'active' ? '' : `${STATUS_LABELS[status]} · `}
        {formatAutomationSchedule(task)}
      </Text>
    </YStack>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} pressStyle={{ opacity: 0.72 }}>
      {content}
    </Pressable>
  );
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

type TimeSelection = {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
};

function toTimeSelection({
  hour,
  minute,
}: Pick<EditableSchedule, 'hour' | 'minute'>): TimeSelection {
  return { hour: hour % 12 || 12, minute, period: hour < 12 ? 'AM' : 'PM' };
}

function fromTimeSelection({ hour, minute, period }: TimeSelection) {
  return { hour: (hour % 12) + (period === 'PM' ? 12 : 0), minute };
}

function formatTimeSelection({ hour, minute, period }: TimeSelection) {
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function repeatLabel(days: number[]) {
  if (days.length === 7) return 'Every day';
  if (days.join() === '1,2,3,4,5') return 'Weekdays';
  if (days.join() === '0,6') return 'Weekends';
  return days.length ? 'Weekly' : 'Pick a day';
}

const FIELD_FRAME = {
  borderWidth: 0,
  borderRadius: '$2xl',
  backgroundColor: '$background',
} as const;

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
  /** Why the task is locked, or anything else the owner should know first. */
  notice?: string;
  promptEditable?: boolean;
  /** Shown in place of the day and time controls when `draft.schedule` is null. */
  scheduleLabel?: string;
  timezone?: string;
  destinationLabel: string;
  onSelectDestination?: (channel: db.Channel) => void;
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
  const [promptHeight, setPromptHeight] = useState(128);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  const schedule = draft.schedule;

  const update = <K extends keyof AutomationTaskDraft>(
    key: K,
    value: AutomationTaskDraft[K]
  ) => onChange({ ...draft, [key]: value });
  const toggleDay = (day: number) => {
    if (disabled || !schedule) return;
    update('schedule', {
      ...schedule,
      days: schedule.days.includes(day)
        ? schedule.days.filter((current) => current !== day)
        : [...schedule.days, day].sort((a, b) => a - b),
    });
  };
  const selectDestination = useCallback(
    async (channel: db.Channel) => onSelectDestination?.(channel),
    [onSelectDestination]
  );
  const { handleChannelSelected, renderFooter: renderDestinationFooter } =
    useForwardToChannelSheet({
      isOpen: destinationSheetOpen,
      onClose: () => setDestinationSheetOpen(false),
      onForwardToChannel: selectDestination,
      successMessage: () => null,
      failureMessage: 'Could not select channel',
      submitLabel: (channelTitle) => `Post to ${channelTitle}`,
      submittingLabel: 'Selecting...',
    });
  const destinationDisabled = disabled || !onSelectDestination;
  const controlOpacity = disabled ? 0.5 : 1;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        backAction={onBack}
        rightActions={[
          {
            id: 'save-scheduled-task',
            text: save.busy ? 'Saving…' : save.label,
            onPress: save.onPress,
            disabled: save.disabled || save.busy,
          },
        ]}
        title={title}
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$2xl"
        paddingTop="$2xl"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$xl">
          {notice ? (
            <Text size="$label/m" color="$secondaryText" padding="$s">
              {notice}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel="Task name"
            editable={!disabled}
            value={draft.name}
            onChangeText={(value) => update('name', value)}
            placeholder="Task name"
            frameStyle={FIELD_FRAME}
          />
          <TextInput
            accessibilityLabel="Task prompt"
            editable={!disabled && promptEditable}
            value={draft.prompt}
            onChangeText={(value) => update('prompt', value)}
            placeholder="What should the bot do?"
            multiline
            numberOfLines={4}
            scrollEnabled={false}
            onContentSizeChange={(event) => {
              setPromptHeight(
                Math.max(
                  128,
                  Math.ceil(event.nativeEvent.contentSize.height) + 24
                )
              );
            }}
            frameStyle={{
              ...FIELD_FRAME,
              height: promptHeight,
              alignItems: 'flex-start',
            }}
          />
          {schedule ? (
            <>
              <YStack
                backgroundColor="$background"
                borderRadius="$2xl"
                padding="$2xl"
                gap="$2xl"
                overflow="hidden"
                opacity={controlOpacity}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <Text size="$label/l">Repeat</Text>
                  <Text size="$label/l" color="$secondaryText">
                    {repeatLabel(schedule.days)}
                  </Text>
                </XStack>
                <XStack gap="$s">
                  {DAY_LABELS.map((label, day) => {
                    const selected = schedule.days.includes(day);
                    return (
                      <Pressable
                        key={DAY_NAMES[day]}
                        accessibilityLabel={DAY_NAMES[day]}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        flex={1}
                        aspectRatio={1}
                        borderRadius="$4xl"
                        alignItems="center"
                        justifyContent="center"
                        backgroundColor={
                          selected ? '$primaryText' : '$secondaryBackground'
                        }
                        onPress={() => toggleDay(day)}
                      >
                        <Text
                          size="$label/m"
                          color={selected ? '$background' : '$tertiaryText'}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </XStack>
              </YStack>
              <Pressable
                accessibilityLabel="Time"
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => setTimeSheetOpen(true)}
                pressStyle={{ opacity: 0.72 }}
              >
                <XStack
                  minHeight={64}
                  backgroundColor="$background"
                  borderRadius="$2xl"
                  paddingHorizontal="$2xl"
                  alignItems="center"
                  justifyContent="space-between"
                  opacity={controlOpacity}
                >
                  <YStack gap="$xs">
                    <Text size="$label/l">Time</Text>
                    {timezone ? (
                      <Text size="$label/s" color="$tertiaryText">
                        {timezone}
                      </Text>
                    ) : null}
                  </YStack>
                  <YStack
                    backgroundColor="$secondaryBackground"
                    borderRadius="$4xl"
                    paddingHorizontal="$xl"
                    paddingVertical="$m"
                  >
                    <Text size="$label/l">
                      {formatTimeSelection(toTimeSelection(schedule))}
                    </Text>
                  </YStack>
                </XStack>
              </Pressable>
            </>
          ) : (
            <YStack
              backgroundColor="$background"
              borderRadius="$2xl"
              padding="$2xl"
              gap="$l"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text size="$label/l">Schedule</Text>
                <Text
                  size="$label/l"
                  color="$secondaryText"
                  flex={1}
                  flexShrink={1}
                  textAlign="right"
                >
                  {scheduleLabel}
                </Text>
              </XStack>
              <Text size="$label/s" color="$tertiaryText">
                Ask your bot to change this schedule.
              </Text>
            </YStack>
          )}
          <Pressable
            accessibilityLabel="Posts to"
            accessibilityRole="button"
            accessibilityState={{ disabled: destinationDisabled }}
            disabled={destinationDisabled}
            onPress={() => setDestinationSheetOpen(true)}
            pressStyle={{ opacity: 0.72 }}
          >
            <XStack
              minHeight={64}
              backgroundColor="$background"
              borderRadius="$2xl"
              paddingHorizontal="$2xl"
              alignItems="center"
              justifyContent="space-between"
              gap="$xl"
              opacity={destinationDisabled ? 0.5 : 1}
            >
              <Text size="$label/l">Posts to</Text>
              <Text
                size="$label/l"
                color="$secondaryText"
                flex={1}
                flexShrink={1}
                textAlign="right"
                numberOfLines={1}
              >
                {destinationLabel}
              </Text>
            </XStack>
          </Pressable>
          {status ? (
            <XStack
              minHeight={64}
              backgroundColor="$background"
              borderRadius="$2xl"
              paddingHorizontal="$2xl"
              alignItems="center"
              justifyContent="space-between"
              gap="$xl"
            >
              <Text size="$label/l" flex={1} flexShrink={1}>
                {STATUS_LABELS[status.value]}
              </Text>
              {status.value === 'held' ? null : (
                <Switch
                  accessibilityLabel="Active"
                  value={status.value === 'active'}
                  disabled={disabled || status.busy}
                  onValueChange={status.onChange}
                />
              )}
            </XStack>
          ) : null}
          {onDelete ? (
            <Button
              preset="destructiveMinimal"
              label="Delete task"
              centered
              loading={deleting}
              disabled={deleting || save.busy}
              onPress={onDelete}
            />
          ) : null}
        </YStack>
      </SettingsContentScrollView>
      {schedule ? (
        <TimePickerSheet
          open={timeSheetOpen}
          onOpenChange={setTimeSheetOpen}
          value={toTimeSelection(schedule)}
          onChange={(time) =>
            update('schedule', { ...schedule, ...fromTimeSelection(time) })
          }
        />
      ) : null}
      <ForwardToChannelSheet
        open={destinationSheetOpen}
        onOpenChange={setDestinationSheetOpen}
        title="Posts to"
        onChannelSelected={handleChannelSelected}
        channelFilter={destinationFilter}
        channelChats={destinationChannelChats}
        footerComponent={renderDestinationFooter}
        allowNotebooks
      />
    </View>
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
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPointsMode="percent"
      snapPoints={[46]}
      modal
    >
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
