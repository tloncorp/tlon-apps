import { describe, expect, it, vi } from 'vitest';

import type { AutomationTaskDraft } from './automationTaskDraft';
import {
  formatTimeSelection,
  fromTimeSelection,
  missingTaskListNotice,
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

  it('shows that a retry after an error is under way', () => {
    const [section] = scheduledTaskListSections({
      ...base,
      error: true,
      available: false,
      retrying: true,
    });
    expect(section.rows[0]).toMatchObject({
      title: 'Trying again…',
      disabled: true,
    });
  });

  it('tells an old node apart from a bot whose list has not come', () => {
    expect(
      scheduledTaskListSections({ ...base, available: false })[0].rows[0].title
    ).toBe('Scheduled tasks unavailable');
    expect(scheduledTaskListSections({ ...base, synced: false })[0].title).toBe(
      "Your bot's tasks have not loaded"
    );
  });

  describe('for a bot whose list has not come', () => {
    const unsynced = { ...base, synced: false, tasks: [] };

    it('offers a refresh, and never a new task', () => {
      const onRefresh = vi.fn();
      const sections = scheduledTaskListSections({
        ...unsynced,
        onAddTask: vi.fn(),
        onRefresh,
      });
      expect(sections).toHaveLength(1);
      expect(sections[0].rows).toHaveLength(1);
      expect(sections[0].rows[0]).toMatchObject({
        title: 'Refresh',
        disabled: false,
      });
      sections[0].rows[0].onPress?.();
      expect(onRefresh).toHaveBeenCalled();
    });

    it('goes busy while the bot is being asked', () => {
      const [section] = scheduledTaskListSections({
        ...unsynced,
        attempt: 'asking',
      });
      expect(section.rows[0]).toMatchObject({
        title: 'Asking your bot…',
        disabled: true,
      });
      expect(section.footer).toBe(
        'Asking your bot for its list of scheduled tasks.'
      );
    });

    it('says the bot still has not answered, and offers another try', () => {
      const [section] = scheduledTaskListSections({
        ...unsynced,
        attempt: 'nothing',
      });
      expect(section.footer).toBe(
        'Your bot still has not sent its list. It may be offline or still starting up. Tasks it already has are not affected.'
      );
      expect(section.rows[0]).toMatchObject({
        title: 'Try again',
        disabled: false,
      });
    });

    it('is busy, and says only that it is checking, for a read alone', () => {
      const [section] = scheduledTaskListSections({
        ...unsynced,
        attempt: 'checking',
      });
      expect(section.rows[0]).toMatchObject({
        title: 'Checking…',
        disabled: true,
      });
      expect(section.footer).toBe(
        "Checking for your bot's list of scheduled tasks."
      );
    });

    it('does not call the bot slow when it was never asked', () => {
      const [section] = scheduledTaskListSections({
        ...unsynced,
        attempt: 'notAsked',
      });
      expect(section.footer).toBe(
        'Your bot still has not sent its list. If your bot is turned off, turn it on and try again.'
      );
      expect(section.footer).not.toMatch(/offline|starting up/);
      expect(section.rows[0]).toMatchObject({
        title: 'Try again',
        disabled: false,
      });
    });

    it('says when the bot could not be asked at all', () => {
      const [section] = scheduledTaskListSections({
        ...unsynced,
        attempt: 'failed',
      });
      expect(section.footer).toBe(
        'Could not ask your bot for its list. Check your connection and try again.'
      );
      expect(section.rows[0]).toMatchObject({
        title: 'Try again',
        disabled: false,
      });
    });
  });
});

describe('missingTaskListNotice', () => {
  const states = [
    undefined,
    'asking',
    'checking',
    'nothing',
    'notAsked',
    'failed',
  ] as const;

  it('cannot be read as a bot with no tasks', () => {
    for (const attempt of states) {
      const { title, body } = missingTaskListNotice(attempt);
      const words = `${title} ${body}`.toLowerCase();
      expect(words).not.toMatch(/no (scheduled )?tasks|nothing is scheduled/);
      expect(words).not.toContain('not synced');
    }
    expect(missingTaskListNotice().body).toBe(
      'Your bot has not sent its list of scheduled tasks yet. Tasks it already has are not affected.'
    );
  });

  it('does not say how soon the list will come', () => {
    for (const attempt of states) {
      const { body } = missingTaskListNotice(attempt);
      expect(body.toLowerCase()).not.toMatch(/moment|shortly|soon|seconds/);
    }
  });

  it('is busy only while a try is out', () => {
    expect(
      states.filter((attempt) => missingTaskListNotice(attempt).busy)
    ).toEqual(['asking', 'checking']);
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
