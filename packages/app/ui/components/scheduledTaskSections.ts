import type { StewardAutomationTask } from '@tloncorp/api/urbit';

import type { SettingsSectionModel } from './SettingsList/types';
import {
  type AutomationTaskDraft,
  type AutomationTaskStatus,
  type EditableSchedule,
  taskStatus,
  taskTitle,
} from './automationTaskDraft';
import { formatAutomationSchedule } from './formatAutomationSchedule';

export interface IdentifiedAutomationTask {
  id: string;
  task: StewardAutomationTask;
}

export type TimeSelection = {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
};

// Short enough for one line in the list on a phone. The editor spells the
// credit hold out.
const PAUSE_LABELS = { paused: 'Paused', held: 'Paused for credits' } as const;

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function toTimeSelection({
  hour,
  minute,
}: Pick<EditableSchedule, 'hour' | 'minute'>): TimeSelection {
  return { hour: hour % 12 || 12, minute, period: hour < 12 ? 'AM' : 'PM' };
}

export function fromTimeSelection({ hour, minute, period }: TimeSelection) {
  return { hour: (hour % 12) + (period === 'PM' ? 12 : 0), minute };
}

export function formatTimeSelection({ hour, minute, period }: TimeSelection) {
  return `${hour}:${minute.toString().padStart(2, '0')} ${period}`;
}

/** The task list, or the one row that explains why there is no list. */
export function scheduledTaskListSections({
  available,
  synced,
  error,
  tasks,
  scope,
  onAddTask,
  onPressTask,
  onRetry,
}: {
  available: boolean;
  synced: boolean;
  error: boolean;
  tasks: IdentifiedAutomationTask[];
  /** The group the list is narrowed to, when it is. */
  scope?: string;
  onAddTask?: () => void;
  onPressTask?: (task: IdentifiedAutomationTask) => void;
  onRetry?: () => void;
}): SettingsSectionModel[] {
  if (error) {
    return [
      {
        key: 'error',
        title: 'Could not load scheduled tasks',
        footer: 'Check your connection and try again.',
        rows: [
          { key: 'retry', title: 'Try again', action: true, onPress: onRetry },
        ],
      },
    ];
  }
  if (!available) {
    return [
      {
        key: 'unavailable',
        footer: 'Your node needs an update before it can show scheduled tasks.',
        rows: [{ key: 'unavailable', title: 'Scheduled tasks unavailable' }],
      },
    ];
  }
  if (!synced) {
    return [
      {
        key: 'unsynced',
        title: 'Scheduled tasks not synced',
        footer:
          'Your bot has not shared its tasks yet. This can take a moment after it starts.',
        rows: [
          { key: 'refresh', title: 'Refresh', action: true, onPress: onRetry },
        ],
      },
    ];
  }

  const sections: SettingsSectionModel[] = [];
  if (tasks.length) {
    sections.push({
      key: 'tasks',
      title: scope ? `Posting to ${scope}` : undefined,
      rows: [...tasks]
        .sort((a, b) => taskTitle(a.task).localeCompare(taskTitle(b.task)))
        .map((identified) => {
          const status = taskStatus(identified.task);
          const schedule = formatAutomationSchedule(identified.task);
          return {
            key: identified.id,
            title: taskTitle(identified.task),
            subtitle:
              status === 'active'
                ? schedule
                : `${PAUSE_LABELS[status]} · ${schedule}`,
            onPress: onPressTask ? () => onPressTask(identified) : undefined,
          };
        }),
    });
  }
  if (onAddTask) {
    sections.push({
      key: 'new',
      footer: tasks.length
        ? undefined
        : scope
          ? `Nothing is scheduled to post to ${scope} yet.`
          : 'Add a task here, or ask your bot to do something on a schedule.',
      rows: [
        {
          key: 'new-task',
          title: 'New task',
          action: true,
          onPress: onAddTask,
          testID: 'NewScheduledTaskRow',
        },
      ],
    });
  }
  return sections;
}

/** One task as an editable form. */
export function taskEditorSections({
  draft,
  onChange,
  disabled = false,
  notice,
  promptEditable = true,
  scheduleLabel,
  timezone,
  destinationLabel,
  onPressTime,
  onPressDestination,
  status,
  onDelete,
  deleting = false,
}: {
  draft: AutomationTaskDraft;
  onChange: (draft: AutomationTaskDraft) => void;
  /** Locks every control, for a task that must not be edited right now. */
  disabled?: boolean;
  /** Why the task is locked. */
  notice?: string;
  promptEditable?: boolean;
  /** Shown in place of the day and time rows when `draft.schedule` is null. */
  scheduleLabel?: string;
  timezone?: string;
  destinationLabel: string;
  onPressTime: () => void;
  onPressDestination?: () => void;
  /** Pause and resume for a task that already exists. */
  status?: {
    value: AutomationTaskStatus;
    busy: boolean;
    onChange: (enabled: boolean) => void;
  };
  onDelete?: () => void;
  deleting?: boolean;
}): SettingsSectionModel[] {
  const { schedule } = draft;
  const sections: SettingsSectionModel[] = [];

  if (status?.value === 'held') {
    sections.push({
      key: 'status',
      footer: notice,
      rows: [{ key: 'held', title: 'Paused while credits are limited' }],
    });
  } else if (status) {
    sections.push({
      key: 'status',
      rows: [
        {
          key: 'active',
          title: 'Active',
          disabled: disabled || status.busy,
          toggle: {
            value: status.value === 'active',
            onValueChange: status.onChange,
          },
          testID: 'ScheduledTaskActiveToggle',
        },
      ],
    });
  }

  sections.push(
    {
      key: 'name',
      title: 'Name',
      rows: [
        {
          key: 'name',
          title: 'Task name',
          disabled,
          textField: {
            value: draft.name,
            onChangeText: (name) => onChange({ ...draft, name }),
            placeholder: 'Task name',
            capitalization: 'sentences',
          },
        },
      ],
    },
    {
      key: 'prompt',
      title: 'Prompt',
      footer: promptEditable
        ? undefined
        : 'Ask your bot to change what this task does.',
      rows: [
        {
          key: 'prompt',
          title: 'Task prompt',
          disabled: disabled || !promptEditable,
          textField: {
            value: draft.prompt,
            onChangeText: (prompt) => onChange({ ...draft, prompt }),
            placeholder: 'What should the bot do?',
            lines: 6,
            capitalization: 'sentences',
          },
        },
      ],
    }
  );

  if (schedule) {
    sections.push(
      {
        key: 'time',
        title: 'Schedule',
        footer: timezone ? `Times are in ${timezone}.` : undefined,
        rows: [
          {
            key: 'time',
            title: 'Time',
            value: formatTimeSelection(toTimeSelection(schedule)),
            disabled,
            accessory: 'none',
            onPress: onPressTime,
          },
        ],
      },
      {
        key: 'days',
        title: 'Repeat',
        rows: DAY_NAMES.map((title, day) => ({
          key: `day-${day}`,
          title,
          selected: schedule.days.includes(day),
          multiple: true,
          disabled,
          onPress: () =>
            onChange({
              ...draft,
              schedule: {
                ...schedule,
                days: schedule.days.includes(day)
                  ? schedule.days.filter((current) => current !== day)
                  : [...schedule.days, day].sort((a, b) => a - b),
              },
            }),
        })),
      }
    );
  } else {
    sections.push({
      key: 'schedule',
      title: 'Schedule',
      footer: 'Ask your bot to change this schedule.',
      rows: [{ key: 'schedule', title: scheduleLabel ?? 'Custom schedule' }],
    });
  }

  sections.push({
    key: 'destination',
    title: 'Posts to',
    rows: [
      {
        key: 'destination',
        title: destinationLabel,
        disabled: disabled || !onPressDestination,
        onPress: onPressDestination,
        testID: 'ScheduledTaskDestinationRow',
      },
    ],
  });

  if (onDelete) {
    sections.push({
      key: 'delete',
      rows: [
        {
          key: 'delete',
          title: deleting ? 'Deleting…' : 'Delete task',
          destructive: true,
          accessory: 'none',
          disabled: deleting,
          onPress: onDelete,
          testID: 'DeleteScheduledTaskRow',
        },
      ],
    });
  }

  return sections;
}
