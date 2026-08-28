import type { StewardAutomationTask } from '@tloncorp/api/urbit';
import { useDebouncedValue } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import { Button, Icon, Pressable, Text } from '@tloncorp/ui';
import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';
import { TextInput } from './Form/inputs';
import type { ForwardChannelChat } from './ForwardChannelSelector';
import { ForwardToChannelSheet } from './ForwardToChannelSheet';
import { ScreenHeader } from './ScreenHeader';
import { SettingsContentScrollView } from './SettingsContentScrollView';
import { formatAutomationSchedule } from './formatAutomationSchedule';
import { useForwardToChannelSheet } from './useForwardToChannelSheet';

export interface IdentifiedAutomationTask {
  id: string;
  task: StewardAutomationTask;
}

export interface RecurringTaskDraft {
  name: string;
  prompt: string;
  repeat: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  selectedDays: number[];
  timeLabel: string;
  destinationLabel: string;
}

export function ScheduledTasksScreenView({
  available,
  loading,
  tasks,
  canMutate,
  onAddTask,
  onBack,
  onPressTask,
}: {
  available: boolean;
  loading?: boolean;
  tasks: IdentifiedAutomationTask[];
  canMutate: boolean;
  onAddTask?: () => void;
  onBack: () => void;
  onPressTask?: (task: IdentifiedAutomationTask) => void;
}) {
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
            visible: canMutate && Boolean(onAddTask),
          },
        ]}
        title="Scheduled"
        placement="navigation"
      />
      {loading ? (
        <ScheduledTasksNotice
          title="Loading scheduled tasks"
          body="Reading the latest definitions mirrored to Steward."
        />
      ) : !available ? (
        <ScheduledTasksNotice
          title="Scheduled tasks unavailable"
          body="This ship does not expose Steward's automation mirror yet."
        />
      ) : tasks.length === 0 ? (
        <ScheduledTasksNotice
          title="No scheduled tasks"
          body="OpenClaw has not mirrored any task definitions for this bot."
          action={
            canMutate && onAddTask
              ? { label: 'New task', onPress: onAddTask }
              : undefined
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

function ScheduledTasksNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
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
  const title = task.name || task.description || 'Untitled task';
  const prompt = task.payload?.message || task.description;
  const content = (
    <YStack padding="$2xl" gap="$2xl">
      <Text size="$label/2xl" fontWeight="600" numberOfLines={1}>
        {title}
      </Text>
      {prompt ? (
        <Text size="$label/xl" color="$secondaryText" numberOfLines={3}>
          {prompt}
        </Text>
      ) : null}
      <Text size="$label/xl" color="$tertiaryText">
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
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

type TimeSelection = {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
};

function parseTimeLabel(value: string): TimeSelection {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);

  if (
    !match ||
    !Number.isInteger(hour) ||
    hour < 1 ||
    hour > 12 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return { hour: 8, minute: 0, period: 'AM' };
  }

  return {
    hour,
    minute,
    period: match[3].toUpperCase() as TimeSelection['period'],
  };
}

function formatTimeSelection({ hour, minute, period }: TimeSelection) {
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

export function RecurringTaskEditorView({
  draft,
  readOnly,
  onChange,
  onBack,
  onAutosave,
  destinationChannelChats,
}: {
  draft: RecurringTaskDraft;
  readOnly: boolean;
  onChange: (draft: RecurringTaskDraft) => void;
  onBack: () => void;
  onAutosave?: (draft: RecurringTaskDraft) => void | Promise<void>;
  destinationChannelChats?: ForwardChannelChat[];
}) {
  const debouncedDraft = useDebouncedValue(draft, 500);
  const lastAutosavedDraft = useRef(draft);
  const [promptHeight, setPromptHeight] = useState(128);
  const [timeSheetOpen, setTimeSheetOpen] = useState(false);
  const [destinationSheetOpen, setDestinationSheetOpen] = useState(false);
  useEffect(() => {
    if (
      readOnly ||
      !onAutosave ||
      debouncedDraft === lastAutosavedDraft.current
    ) {
      return;
    }
    lastAutosavedDraft.current = debouncedDraft;
    void onAutosave(debouncedDraft);
  }, [debouncedDraft, onAutosave, readOnly]);

  const update = <K extends keyof RecurringTaskDraft>(
    key: K,
    value: RecurringTaskDraft[K]
  ) => onChange({ ...draft, [key]: value });
  const toggleDay = (day: number) => {
    if (readOnly) return;
    update(
      'selectedDays',
      draft.selectedDays.includes(day)
        ? draft.selectedDays.filter((current) => current !== day)
        : [...draft.selectedDays, day].sort()
    );
  };
  const updateDestination = useCallback(
    async (channel: db.Channel) => {
      const destination = channel.title?.trim() || 'Direct message';
      onChange({ ...draft, destinationLabel: destination });
    },
    [draft, onChange]
  );
  const { handleChannelSelected, renderFooter: renderDestinationFooter } =
    useForwardToChannelSheet({
      isOpen: destinationSheetOpen,
      onClose: () => setDestinationSheetOpen(false),
      onForwardToChannel: updateDestination,
      successMessage: () => null,
      failureMessage: 'Could not select channel',
      submitLabel: (channelTitle) => `Post to ${channelTitle}`,
      submittingLabel: 'Selecting...',
    });
  const timeDisabled = readOnly;
  const destinationDisabled = readOnly;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        backAction={onBack}
        title="Recurring task"
        placement="navigation"
      />
      <SettingsContentScrollView
        paddingHorizontal="$2xl"
        paddingTop="$2xl"
        safeAreaBottomOffset={24}
      >
        <YStack gap="$xl">
          <TextInput
            accessibilityLabel="Task name"
            editable={!readOnly}
            value={draft.name}
            onChangeText={(value) => update('name', value)}
            placeholder="Task name"
            frameStyle={{
              borderWidth: 0,
              borderRadius: '$2xl',
              backgroundColor: '$background',
            }}
          />
          <TextInput
            accessibilityLabel="Task prompt"
            editable={!readOnly}
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
              height: promptHeight,
              // InputFrame is an XStack, so the cross axis is vertical:
              // flex-start would leave the input at the intrinsic height of
              // numberOfLines and scrolling inside the grown frame. Stretch so
              // it fills the height onContentSizeChange measured for it.
              alignItems: 'stretch',
              borderWidth: 0,
              borderRadius: '$2xl',
              backgroundColor: '$background',
            }}
          />
          <YStack
            backgroundColor="$background"
            borderRadius="$2xl"
            padding="$2xl"
            gap="$2xl"
            overflow="hidden"
          >
            <XStack justifyContent="space-between" alignItems="center">
              <Text size="$label/l">Repeat</Text>
              <Text size="$label/l" color="$secondaryText">
                {draft.repeat}
              </Text>
            </XStack>
            <XStack gap="$s">
              {DAY_LABELS.map((label, day) => {
                const selected = draft.selectedDays.includes(day);
                return (
                  <Pressable
                    key={`${label}-${day}`}
                    flex={1}
                    aspectRatio={1}
                    borderRadius="$4xl"
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={
                      selected ? '$primaryText' : '$secondaryBackground'
                    }
                    disabled={readOnly}
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
            accessibilityState={{ disabled: timeDisabled }}
            disabled={timeDisabled}
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
            >
              <Text size="$label/l">Time</Text>
              <YStack
                backgroundColor="$secondaryBackground"
                borderRadius="$4xl"
                paddingHorizontal="$xl"
                paddingVertical="$m"
              >
                <Text size="$label/l">{draft.timeLabel}</Text>
              </YStack>
            </XStack>
          </Pressable>
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
            >
              <Text size="$label/l">Posts to</Text>
              <Text size="$label/l" color="$secondaryText">
                {draft.destinationLabel}
              </Text>
            </XStack>
          </Pressable>
          {readOnly ? (
            <Text size="$label/s" color="$secondaryText" padding="$s">
              Steward mirrors definitions but cannot edit OpenClaw schedules
              yet.
            </Text>
          ) : null}
        </YStack>
      </SettingsContentScrollView>
      <TimePickerSheet
        open={timeSheetOpen}
        onOpenChange={setTimeSheetOpen}
        value={draft.timeLabel}
        onChange={(time) => update('timeLabel', time)}
      />
      <ForwardToChannelSheet
        open={destinationSheetOpen}
        onOpenChange={setDestinationSheetOpen}
        title="Posts to"
        onChannelSelected={handleChannelSelected}
        channelChats={destinationChannelChats}
        footerComponent={renderDestinationFooter}
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
  value: string;
  onChange: (value: string) => void;
}) {
  const [selection, setSelection] = useState(() => parseTimeLabel(value));

  useEffect(() => {
    if (open) {
      setSelection(parseTimeLabel(value));
    }
  }, [open, value]);

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
            onValueChange={(hour) =>
              setSelection((current) => ({ ...current, hour: Number(hour) }))
            }
            style={{ flex: 1 }}
          >
            {HOURS.map((hour) => (
              <Picker.Item key={hour} label={`${hour}`} value={hour} />
            ))}
          </Picker>
          <Picker
            accessibilityLabel="Minute"
            selectedValue={selection.minute}
            onValueChange={(minute) =>
              setSelection((current) => ({
                ...current,
                minute: Number(minute),
              }))
            }
            style={{ flex: 1 }}
          >
            {MINUTES.map((minute) => (
              <Picker.Item
                key={minute}
                label={minute.toString().padStart(2, '0')}
                value={minute}
              />
            ))}
          </Picker>
          <Picker
            accessibilityLabel="AM or PM"
            selectedValue={selection.period}
            onValueChange={(period) =>
              setSelection((current) => ({
                ...current,
                period: period as TimeSelection['period'],
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
            onChange(formatTimeSelection(selection));
            onOpenChange(false);
          }}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
