import {
  formatWallTime,
  pluralize,
  runMetrics,
  summarizeContext,
  summarizeWrites,
} from './Channel/ContextLens/format';
import {
  type LensMessageTarget,
  contextSourceItems,
  persistenceItems,
  toolRunFact,
  triggerFacts,
} from './Channel/ContextLens/runFacts';
import type {
  ContextLens,
  ContextLensOutput,
} from './Channel/ContextLens/types';
import type { SettingsRowModel, SettingsSectionModel } from './SettingsList';
import {
  TASK_RUN_OUTCOME_LABELS,
  formatRunDay,
  formatRunTime,
  groupRunsByDay,
  isTestRun,
  taskRunError,
  taskRunOutcome,
  taskRunOutput,
} from './taskRuns';

/**
 * One scheduled task's runs, newest first and cut into days, as settings
 * sections: each run a row that opens it.
 */
export function taskRunHistorySections({
  taskName,
  runs,
  total,
  now,
  error = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onPressRun,
  onRetry,
}: {
  taskName?: string;
  runs: ContextLens[];
  total?: number;
  now: number;
  error?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onPressRun: (lens: ContextLens) => void;
  onRetry?: () => void;
}): SettingsSectionModel[] {
  if (!runs.length) {
    return [
      error
        ? {
            key: 'error',
            title: 'Could not load runs',
            footer: 'Check your connection and try again.',
            rows: [
              {
                key: 'retry',
                title: 'Try again',
                action: true,
                onPress: onRetry,
              },
            ],
          }
        : {
            key: 'empty',
            footer:
              'Runs show up here after the task runs on its schedule, or after you test it.',
            rows: [{ key: 'empty', title: 'No runs yet' }],
          },
    ];
  }

  const sections: SettingsSectionModel[] = [];
  if (error) {
    sections.push({
      key: 'refresh-failed',
      title: 'Could not refresh runs',
      footer: 'The runs below may be out of date.',
      rows: [
        {
          key: 'retry',
          title: 'Try again',
          action: true,
          onPress: onRetry,
          testID: 'TaskRunHistoryRefreshFailed',
        },
      ],
    });
  }
  if (taskName) {
    sections.push({
      key: 'task',
      rows: [
        {
          key: 'task',
          title: taskName,
          value: pluralize(Math.max(total ?? 0, runs.length), 'run'),
        },
      ],
    });
  }
  for (const day of groupRunsByDay(runs, now)) {
    sections.push({
      key: day.key,
      title: day.label,
      rows: day.runs.map((lens) => runRow(lens, () => onPressRun(lens))),
    });
  }
  if (hasMore && onLoadMore) {
    sections.push({
      key: 'more',
      rows: [
        {
          key: 'more',
          title: loadingMore ? 'Loading…' : 'Show older runs',
          action: true,
          disabled: loadingMore,
          onPress: onLoadMore,
          testID: 'TaskRunHistoryLoadMore',
        },
      ],
    });
  }
  return sections;
}

function runRow(lens: ContextLens, onPress: () => void): SettingsRowModel {
  const outcome = taskRunOutcome(lens);
  // One paragraph, so a reply that opens with a short line still previews
  // its substance.
  const preview = (
    outcome === 'failed'
      ? (taskRunError(lens) ?? taskRunOutput(lens))
      : taskRunOutput(lens)
  )
    ?.replace(/\s+/g, ' ')
    .trim();
  return {
    key: lens.lensId,
    title: formatRunTime(lens.createdAt),
    subtitle: preview || undefined,
    value: TASK_RUN_OUTCOME_LABELS[outcome],
    badge: isTestRun(lens) ? 'Test' : undefined,
    onPress,
    testID: `TaskRun-${lens.lensId}`,
  };
}

/**
 * One run of a scheduled task as settings sections: what it produced first,
 * then the run itself, with the facts Context Lens shows for any bot run. The
 * outcome is the task's, not the lens's own status, which says the agent
 * finished but not that the task's post went out.
 */
export function taskRunDetailSections({
  lens,
  now,
  destinationLabel,
  expandedTools,
  onToggleTool,
  onPressMessage,
  onPressOutput,
}: {
  lens: ContextLens;
  now: number;
  destinationLabel?: string;
  /** The tool calls whose arguments are shown in full. */
  expandedTools: ReadonlySet<string>;
  onToggleTool: (toolRunId: string) => void;
  onPressMessage?: (target: LensMessageTarget) => void;
  /** Opens the post an output became. */
  onPressOutput?: (output: ContextLensOutput) => void;
}): SettingsSectionModel[] {
  const outcome = taskRunOutcome(lens);
  const output = taskRunOutput(lens);
  const error = outcome === 'failed' ? taskRunError(lens) : null;
  const test = isTestRun(lens);

  const outputRows: SettingsRowModel[] = [];
  if (outcome === 'running') {
    outputRows.push({
      key: 'running',
      title:
        'Your bot is working on it. The output shows here when it finishes.',
      expanded: true,
    });
  } else if (output) {
    outputRows.push({
      key: 'output',
      title: output,
      expanded: true,
      testID: 'TaskRunOutput',
    });
  } else if (!error) {
    outputRows.push({
      key: 'none',
      title:
        outcome === 'no-output'
          ? 'The task finished without producing anything to post.'
          : 'No output was recorded for this run.',
      expanded: true,
    });
  }
  if (error) {
    outputRows.push({ key: 'error', title: error, expanded: true });
  }

  const sources = lens.context.sources ?? [];
  const toolRuns = lens.tools.runs ?? [];
  const outputs = lens.outputs ?? [];
  const persistence = persistenceItems(lens);

  return [
    {
      key: 'output',
      title: 'Output',
      footer: test
        ? 'Test run. Nothing was posted and the schedule is unchanged.'
        : destinationLabel
          ? `Posted to ${destinationLabel}.`
          : undefined,
      rows: outputRows,
    },
    {
      key: 'run',
      rows: [
        {
          key: 'outcome',
          title: 'Outcome',
          value: TASK_RUN_OUTCOME_LABELS[outcome],
        },
        {
          key: 'started',
          title: 'Started',
          value: `${formatRunDay(lens.createdAt, now)}, ${formatRunTime(lens.createdAt)}`,
        },
        // The trigger section says what kind of run it was.
        ...runMetrics(lens)
          .filter((metric) => metric.label !== 'Run')
          .map((metric) => ({
            key: metric.label,
            title: metric.label,
            value: metric.value,
          })),
      ],
    },
    {
      key: 'trigger',
      title: 'Trigger',
      rows: [
        ...triggerFacts(lens).map((fact): SettingsRowModel => {
          const target = fact.target;
          return {
            key: fact.label,
            title: fact.label,
            value: fact.value,
            onPress:
              onPressMessage && target
                ? () => onPressMessage(target)
                : undefined,
          };
        }),
        ...(lens.triggerDetails?.preview
          ? [
              {
                key: 'preview',
                title: lens.triggerDetails.preview,
                expanded: false,
              },
            ]
          : []),
      ],
    },
    {
      key: 'context',
      title: 'Context',
      rows: [
        {
          key: 'included',
          title: 'Included',
          value: pluralize(
            sources.filter((source) => source.included).length,
            'source'
          ),
        },
        {
          key: 'excluded',
          title: 'Excluded',
          value: pluralize(
            sources.filter((source) => !source.included).length,
            'source'
          ),
        },
        ...(sources.length
          ? contextSourceItems(lens).map((item) => ({
              key: item.key,
              title: item.title,
              subtitle: `${item.meta} · ${item.detail}`,
            }))
          : [{ key: 'summary', title: summarizeContext(lens) }]),
      ],
    },
    {
      key: 'tools',
      title: 'Tools',
      rows: toolRuns.length
        ? toolRuns.map((run): SettingsRowModel => {
            const fact = toolRunFact(run);
            const expanded = expandedTools.has(run.id);
            return {
              key: run.id,
              title: fact.title,
              value: fact.status,
              subtitle:
                expanded && run.argumentDetail
                  ? `${fact.detail}\n\n${run.argumentDetail}`
                  : fact.detail,
              ...(run.argumentDetail
                ? {
                    expanded,
                    accessory: 'none' as const,
                    onPress: () => onToggleTool(run.id),
                  }
                : {}),
            };
          })
        : [{ key: 'none', title: 'No tools called' }],
    },
    ...(test
      ? []
      : [
          {
            key: 'posts',
            title: 'Posts',
            rows: outputs.length
              ? outputs.map(
                  (post, index): SettingsRowModel => ({
                    key: `${post.messageId}-${index}`,
                    title: post.preview ?? post.conversationId,
                    subtitle: `${post.kind} · ${formatWallTime(post.sentAt)}`,
                    onPress: onPressOutput
                      ? () => onPressOutput(post)
                      : undefined,
                  })
                )
              : [{ key: 'none', title: 'No bot reply recorded yet' }],
          },
        ]),
    {
      key: 'persistence',
      title: 'Persistence',
      rows: persistence.length
        ? persistence.map((item) => ({
            key: item.key,
            title: item.title,
            value: item.meta,
            subtitle: item.detail,
          }))
        : [{ key: 'none', title: summarizeWrites(lens) }],
    },
  ];
}
