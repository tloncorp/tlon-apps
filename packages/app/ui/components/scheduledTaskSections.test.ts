import { describe, expect, it, vi } from 'vitest';

import type { AutomationTaskDraft } from './automationTaskDraft';
import {
  formatTimeSelection,
  fromTimeSelection,
  scheduledTaskListSections,
  taskEditorSections,
  toTimeSelection,
} from './scheduledTaskSections';

const tasks = [
  {
    id: 'b',
    task: {
      name: 'Weekly digest',
      enabled: false,
      schedule: { kind: 'cron' as const, expr: '0 9 * * 1' },
    },
  },
  {
    id: 'a',
    task: {
      name: 'Morning news',
      enabled: true,
      schedule: { kind: 'cron' as const, expr: '0 7 * * 1-5' },
    },
  },
  {
    id: 'c',
    task: {
      name: 'Backup check',
      enabled: false,
      description: '[Paused: credit budget]',
      schedule: { kind: 'every' as const, everyMs: 3_600_000 },
    },
  },
];

const draft: AutomationTaskDraft = {
  name: 'Morning news',
  prompt: 'Summarize the news.',
  schedule: { days: [1, 2, 3, 4, 5], hour: 7, minute: 0 },
  destination: { kind: 'dm', ship: '~zod' },
};

function rowKeys(sections: ReturnType<typeof taskEditorSections>) {
  return sections.flatMap((section) => section.rows.map((row) => row.key));
}

describe('time selection', () => {
  it.each([
    [0, 0, '12:00 AM'],
    [7, 5, '7:05 AM'],
    [12, 30, '12:30 PM'],
    [23, 59, '11:59 PM'],
  ])('round-trips %i:%i as %s', (hour, minute, label) => {
    const selection = toTimeSelection({ hour, minute });
    expect(formatTimeSelection(selection)).toBe(label);
    expect(fromTimeSelection(selection)).toEqual({ hour, minute });
  });
});

describe('scheduledTaskListSections', () => {
  const base = { available: true, synced: true, error: false, tasks };

  it('lists tasks by name with their schedule and any pause', () => {
    const [list, add] = scheduledTaskListSections({
      ...base,
      onAddTask: vi.fn(),
    });
    expect(list.rows.map((row) => [row.title, row.subtitle])).toEqual([
      ['Backup check', 'Paused for credits · Every 1 hour'],
      ['Morning news', 'Weekdays at 7:00 AM'],
      ['Weekly digest', 'Paused · Mondays at 9:00 AM'],
    ]);
    expect(add.rows[0]).toMatchObject({ title: 'New task', action: true });
    expect(add.footer).toBeUndefined();
  });

  it('opens the task that was pressed', () => {
    const onPressTask = vi.fn();
    const [list] = scheduledTaskListSections({ ...base, onPressTask });
    list.rows[1].onPress?.();
    expect(onPressTask).toHaveBeenCalledWith(tasks[1]);
  });

  it('explains an empty list beside the way to add a task', () => {
    const sections = scheduledTaskListSections({
      ...base,
      tasks: [],
      onAddTask: vi.fn(),
    });
    expect(sections).toHaveLength(1);
    expect(sections[0].footer).toContain('ask your bot');
  });

  it('names the group a narrowed list belongs to', () => {
    const [list] = scheduledTaskListSections({ ...base, scope: 'Book Club' });
    expect(list.title).toBe('Posting to Book Club');

    const [empty] = scheduledTaskListSections({
      ...base,
      tasks: [],
      scope: 'Book Club',
      onAddTask: vi.fn(),
    });
    expect(empty.footer).toBe('Nothing is scheduled to post to Book Club yet.');
  });

  it('offers a retry on an error before anything else', () => {
    const onRetry = vi.fn();
    const [section] = scheduledTaskListSections({
      ...base,
      error: true,
      available: false,
      onRetry,
    });
    expect(section.title).toBe('Could not load scheduled tasks');
    section.rows[0].onPress?.();
    expect(onRetry).toHaveBeenCalled();
  });

  it('tells an old node apart from a bot that has not synced', () => {
    expect(
      scheduledTaskListSections({ ...base, available: false })[0].rows[0].title
    ).toBe('Scheduled tasks unavailable');
    expect(scheduledTaskListSections({ ...base, synced: false })[0].title).toBe(
      'Scheduled tasks not synced'
    );
  });
});

describe('taskEditorSections', () => {
  const base = {
    draft,
    onChange: vi.fn(),
    destinationLabel: 'Direct message to you',
    onPressTime: vi.fn(),
    onPressDestination: vi.fn(),
  };

  it('gives a new task no status or delete row', () => {
    expect(rowKeys(taskEditorSections(base))).toEqual([
      'name',
      'prompt',
      'time',
      'day-0',
      'day-1',
      'day-2',
      'day-3',
      'day-4',
      'day-5',
      'day-6',
      'destination',
    ]);
  });

  it('toggles a day and keeps the days sorted', () => {
    const onChange = vi.fn();
    const sections = taskEditorSections({ ...base, onChange });
    const days = sections.find((section) => section.key === 'days');
    expect(days?.rows.map((row) => row.selected)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    days?.rows[0].onPress?.();
    expect(onChange).toHaveBeenLastCalledWith({
      ...draft,
      schedule: { days: [0, 1, 2, 3, 4, 5], hour: 7, minute: 0 },
    });
    days?.rows[3].onPress?.();
    expect(onChange).toHaveBeenLastCalledWith({
      ...draft,
      schedule: { days: [1, 2, 4, 5], hour: 7, minute: 0 },
    });
  });

  it('shows a schedule it cannot edit as one plain row', () => {
    const sections = taskEditorSections({
      ...base,
      draft: { ...draft, schedule: null },
      scheduleLabel: 'Every 4 hours',
    });
    const schedule = sections.find((section) => section.key === 'schedule');
    expect(schedule?.rows).toEqual([
      { key: 'schedule', title: 'Every 4 hours' },
    ]);
    expect(schedule?.footer).toBe('Ask your bot to change this schedule.');
    expect(rowKeys(sections)).not.toContain('time');
  });

  it('pauses and resumes with a toggle', () => {
    const onChange = vi.fn();
    const [status] = taskEditorSections({
      ...base,
      status: { value: 'paused', busy: false, onChange },
      onDelete: vi.fn(),
    });
    expect(status.rows[0].toggle?.value).toBe(false);
    status.rows[0].toggle?.onValueChange(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('locks a task held for credits but still lets it be deleted', () => {
    const sections = taskEditorSections({
      ...base,
      disabled: true,
      notice: 'Paused while your credits are limited.',
      status: { value: 'held', busy: false, onChange: vi.fn() },
      onDelete: vi.fn(),
    });
    expect(sections[0]).toMatchObject({
      footer: 'Paused while your credits are limited.',
      rows: [{ key: 'held', title: 'Paused while credits are limited' }],
    });
    const rows = sections.flatMap((section) => section.rows);
    const editable = rows.filter((row) =>
      /^(name|prompt|time|day-\d|destination)$/.test(row.key)
    );
    expect(editable.every((row) => row.disabled)).toBe(true);
    expect(rows.find((row) => row.key === 'delete')?.disabled).toBe(false);
  });

  it('locks only the prompt when its payload kind is unknown', () => {
    const sections = taskEditorSections({ ...base, promptEditable: false });
    const prompt = sections.find((section) => section.key === 'prompt');
    expect(prompt?.rows[0].disabled).toBe(true);
    expect(prompt?.footer).toBe('Ask your bot to change what this task does.');
    expect(
      sections.find((section) => section.key === 'name')?.rows[0].disabled
    ).toBe(false);
  });
});
