import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { JSONContent } from '@tloncorp/api/urbit';
import type { JSONValue } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import type { A2UI } from '@tloncorp/shared/logic';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { Image, Platform, useWindowDimensions } from 'react-native';
import { View, useTheme } from 'tamagui';

import { ShipProvider } from '../contexts/ship';
import { nativeHeaderPresentationOptions } from '../navigation/nativeHeaderOptions';
import {
  AppDataContextProvider,
  ChatMessage,
  type IdentifiedAutomationTask,
  RecurringTaskEditorView,
  ScheduledTasksScreenView,
  ScreenHeader,
  ScrollView,
  UserProfileScreenView,
} from '../ui';
import {
  type DraftInputContext,
  DraftInputContextProvider,
} from '../ui/components/draftInputs/shared';
import {
  type AutomationTaskDraft,
  draftFromTask,
  newTaskDraft,
  taskStatus,
} from '../ui/components/automationTaskDraft';
import type { ContextLens } from '../ui/components/Channel/ContextLens/types';
import {
  TaskRunDetailView,
  TaskRunHistoryView,
} from '../ui/components/TaskRunHistory';
import { formatAutomationSchedule } from '../ui/components/formatAutomationSchedule';
import { runHistorySubtitle } from '../ui/components/taskRuns';
import { ChannelProvider } from '../ui/contexts/channel';
import { FixtureWrapper } from './FixtureWrapper';
import { makePost, verse } from './contentHelpers';
import {
  danContact,
  group,
  hostedBotContact,
  initialContacts,
  tlonLocalBulletinBoard,
  tlonLocalIntros,
  tlonLocalWaterCooler,
} from './fakeData';

const noop = () => {};
const FixtureStack = createNativeStackNavigator<{ Surface: undefined }>();
const botContact = {
  ...hostedBotContact,
  id: '~pinser-botter-solfer-magfed',
  nickname: '🌱 News reader',
  // Metro resolves the asset; the web renderer has no `require`.
  avatarImage:
    Platform.OS === 'web'
      ? null
      : Image.resolveAssetSource(require('../ui/assets/raster/bot.png')).uri,
  isContact: false,
  isContactSuggestion: true,
  isBlocked: false,
};
const botDmChannel = {
  ...tlonLocalIntros,
  id: botContact.id,
  type: 'dm' as const,
  groupId: null,
  contactId: botContact.id,
  title: botContact.nickname,
};

const taskDefinitions: IdentifiedAutomationTask[] = [
  {
    id: 'morning-news',
    task: {
      name: 'Morning news summary',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 7 * * 1-5',
        tz: 'America/New_York',
      },
      sessionTarget: 'isolated',
      payload: {
        kind: 'agentTurn',
        message:
          "Summarize today's five most important news stories, with a short explanation of why each matters. Link to the original reporting, prioritize technology and science, and skip sports unless there is major breaking news.",
      },
      delivery: { mode: 'announce', channel: 'tlon', to: danContact.id },
    },
  },
  {
    id: 'ship-backup',
    task: {
      name: 'Ship backup check',
      description: '[Paused: credit budget]',
      enabled: false,
      schedule: { kind: 'cron', expr: '0 2 * * *', tz: 'UTC' },
      payload: {
        kind: 'agentTurn',
        message:
          "Check that last night's ship backup completed, confirm the archive can be opened, and report the backup size. If anything failed, identify the most recent healthy backup and suggest the safest next step.",
      },
    },
  },
  {
    id: 'weekly-digest',
    task: {
      name: 'Weekly group digest',
      enabled: true,
      schedule: {
        kind: 'cron',
        expr: '0 9 * * 1',
        tz: 'America/New_York',
      },
      payload: {
        kind: 'agentTurn',
        message:
          "Review this week's conversations and produce a concise digest of decisions, unresolved questions, promised follow-ups, and messages that still need a reply. Group related items together and mention the responsible person when one is clear.",
      },
      delivery: {
        mode: 'announce',
        channel: 'tlon',
        to: `chat/${tlonLocalWaterCooler.id}`,
      },
    },
  },
  {
    id: 'unread-triage',
    task: {
      name: 'Unread triage',
      enabled: true,
      schedule: { kind: 'every', everyMs: 4 * 60 * 60 * 1000 },
      delivery: { mode: 'none', channel: 'last' },
      payload: {
        kind: 'agentTurn',
        message:
          'Review unread messages across my direct messages and groups. Flag only messages that mention me, ask me a direct question, assign me work, or are blocking a decision. For each item, include the sender, conversation, a one-sentence summary, and the specific response or action needed. Group duplicate requests together, put urgent or time-sensitive items first, and ignore announcements, reactions, automated notices, and threads where someone else has already provided a complete answer. End with a short count of urgent items, replies needed today, and items that can wait.',
      },
    },
  },
  {
    id: 'monthly-bill',
    task: {
      name: 'Monthly bill reminder',
      description: 'Remind the group to settle the server bill.',
      enabled: false,
      schedule: { kind: 'cron', expr: '0 10 1 * *', tz: 'UTC' },
    },
  },
];

const HOUR = 3_600_000;
const runNow = Date.now();
const morningOf = (daysAgo: number) => {
  const day = new Date(runNow - daysAgo * 24 * HOUR);
  day.setHours(7, 0, 0, 0);
  return day.getTime();
};

const digestText =
  'Five things this morning:\n\n— Port strike enters day four; container backlogs now reach the Gulf ports.\n— Appeals court narrows the chip export rule, sending it back for comment.\n— City council moved the budget vote to next Tuesday.\n— Two grocery recalls were announced, both for packaged salad.\n— Rain arrives Thursday and stays through the weekend.';

function taskRun({
  lensId,
  createdAt,
  status = 'completed',
  error = null,
  test = false,
  output,
  outcome,
  posted,
  tools = [],
  durationMs = 42_000,
}: {
  lensId: string;
  createdAt: number;
  status?: ContextLens['status'];
  error?: string | null;
  test?: boolean;
  output?: string;
  outcome?: NonNullable<ContextLens['cron']>['outcome'];
  posted?: string;
  tools?: string[];
  durationMs?: number | null;
}): ContextLens {
  return {
    lensId,
    messageId: `cron:${lensId}:${createdAt}`,
    chatType: 'internal',
    runKind: 'cron',
    visibility: 'owner',
    trigger: 'cron',
    triggerDetails: {
      type: 'cron',
      messageId: `cron:${lensId}:${createdAt}`,
      conversationId: 'session:3f9a',
      conversationKind: 'internal',
      receivedAt: createdAt,
      preview: 'cron job morning-news',
    },
    cron: {
      jobId: 'morning-news',
      ...(test ? { test: true } : {}),
      ...(output ? { output } : {}),
      ...(outcome ? { outcome } : {}),
    },
    model: 'claude-sonnet-5-5',
    provider: 'anthropic',
    status,
    error,
    createdAt,
    updatedAt: createdAt + (durationMs ?? 0),
    context: {
      currentMessage: true,
      threadMessages: 0,
      channelMessages: 0,
      citedPosts: 0,
      attachments: 0,
      pendingNudge: false,
      sources: [
        {
          kind: 'message',
          label: 'Current message',
          included: true,
          reason: 'trigger',
          preview: 'cron job morning-news',
        },
      ],
    },
    persistence: {
      postsReply: Boolean(posted),
      updatesSettings: false,
      writesMedia: false,
      emitsTelemetry: false,
      cachesHistory: false,
      events: [],
    },
    tools: {
      ownerOnlyAvailable: [],
      called: [...new Set(tools)],
      callCount: tools.length,
      lastStartedAt: tools.length ? createdAt + 2_000 : null,
      runs: tools.map((name, index) => ({
        id: `${lensId}-${index}`,
        callIndex: index + 1,
        name,
        startedAt: createdAt + 2_000 + index * 4_000,
        completedAt: createdAt + 5_000 + index * 4_000,
        durationMs: 3_000,
        status: 'completed' as const,
        argumentSummary:
          name === 'web_search' ? 'query: top news today' : undefined,
      })),
    },
    outputs: posted
      ? [
          {
            messageId: `~pinser-botter-solfer-magfed/${createdAt}`,
            conversationId: `chat/${tlonLocalWaterCooler.id}`,
            kind: 'channel',
            sentAt: createdAt + (durationMs ?? 0),
            preview: posted,
          },
        ]
      : [],
    lifecycle: {
      queuedMs: 0,
      durationMs,
      timeoutMs: null,
      timedOut: false,
      deliveredMessageCount: posted ? 1 : 0,
      queuedFinal: false,
      queuedFinalCount: 0,
      queuedBlockCount: 0,
    },
  };
}

const sampleRuns: ContextLens[] = [
  taskRun({
    lensId: 'test-now',
    createdAt: runNow - 4 * 60_000,
    status: 'tool_running',
    test: true,
    tools: ['web_search'],
    durationMs: null,
  }),
  taskRun({
    lensId: 'test-earlier',
    createdAt: runNow - 2 * HOUR,
    test: true,
    output: digestText,
    tools: ['web_search', 'web_search', 'web_fetch'],
  }),
  taskRun({
    lensId: 'today',
    createdAt: morningOf(0),
    posted: digestText,
    outcome: { status: 'ok', delivered: true, deliveryStatus: 'delivered' },
    tools: ['web_search', 'web_fetch'],
  }),
  taskRun({
    lensId: 'yesterday',
    createdAt: morningOf(1),
    status: 'error',
    error: 'Provider overloaded after 3 retries',
    outcome: {
      status: 'error',
      error: 'Provider overloaded after 3 retries',
      delivered: false,
    },
    durationMs: 91_000,
  }),
  taskRun({
    lensId: 'two-days',
    createdAt: morningOf(2),
    status: 'no_reply',
    outcome: { status: 'skipped', delivered: false },
    durationMs: 8_000,
  }),
  taskRun({
    lensId: 'three-days',
    createdAt: morningOf(3),
    posted:
      'Three things this morning: the transit strike ended, the library reopens Monday, and a heat advisory runs through Friday.',
    outcome: { status: 'ok', delivered: true, deliveryStatus: 'delivered' },
    tools: ['web_search'],
  }),
  taskRun({
    lensId: 'nine-days',
    createdAt: morningOf(9),
    posted: 'Quiet morning: two stories worth reading, both about the port.',
    outcome: { status: 'ok', delivered: true, deliveryStatus: 'delivered' },
    tools: ['web_search'],
  }),
];

function FullScreen({ children }: { children: React.ReactNode }) {
  // The web renderer gives the page no height, so the stack would collapse
  // to its header.
  const { height } = useWindowDimensions();
  return (
    <FixtureWrapper fillHeight fillWidth verticalAlign="top">
      <View style={{ height }} width="100%">
        <FixtureStack.Navigator
          screenOptions={{
            ...nativeHeaderPresentationOptions,
            headerShown: true,
            headerBackVisible: false,
          }}
        >
          <FixtureStack.Screen name="Surface">
            {() => (
              <View flex={1} backgroundColor="$background">
                {children}
              </View>
            )}
          </FixtureStack.Screen>
        </FixtureStack.Navigator>
      </View>
    </FixtureWrapper>
  );
}

function BotProfileFixture() {
  const theme = useTheme();

  return (
    <FullScreen>
      <AppDataContextProvider
        currentUserId={danContact.id}
        contacts={[...initialContacts, botContact]}
      >
        <View flex={1} backgroundColor={theme.secondaryBackground.val}>
          <ScreenHeader
            title="Profile"
            backgroundColor={theme.secondaryBackground.val}
            backAction={noop}
            rightActions={[
              {
                id: 'scheduled-tasks',
                icon: 'Clock',
                label: 'Scheduled tasks',
                onPress: noop,
              },
            ]}
            placement="navigation"
          />
          <UserProfileScreenView
            userId={botContact.id}
            connectionStatus={{ complete: true, status: 'yes' }}
            onPressBotSettings={noop}
            onPressGroup={noop}
          />
        </View>
      </AppDataContextProvider>
    </FullScreen>
  );
}

function TaskListFixture({ empty = false }: { empty?: boolean }) {
  return (
    <FullScreen>
      <ScheduledTasksScreenView
        available
        tasks={empty ? [] : taskDefinitions}
        onAddTask={noop}
        onPressTask={noop}
        onBack={noop}
      />
    </FullScreen>
  );
}

const recurringTaskGroup: db.Group = {
  ...group,
  id: '~nibset-napwyn/tlon',
  title: 'Tlon',
};

const destinationChannelChats: Array<db.Chat & { type: 'channel' }> = [
  { channel: tlonLocalWaterCooler, title: 'General' },
  { channel: tlonLocalIntros, title: 'News' },
  { channel: tlonLocalBulletinBoard, title: 'Announcements' },
].map(({ channel, title }, index) => ({
  id: `chat/${channel.id}`,
  type: 'channel',
  channel: {
    ...channel,
    id: `chat/${channel.id}`,
    title,
    groupId: recurringTaskGroup.id,
    group: recurringTaskGroup,
  },
  pin: null,
  volumeSettings: null,
  timestamp: Date.now() - index * 60_000,
  isPending: false,
  unreadCount: channel.unreadCount ?? 0,
}));

function TaskEditorFixture({
  taskId,
  runs = sampleRuns.slice(2),
}: {
  taskId?: string;
  runs?: ContextLens[];
}) {
  const task = taskDefinitions.find(({ id }) => id === taskId)?.task;
  const [draft, setDraft] = useState<AutomationTaskDraft>(() =>
    task ? draftFromTask(task) : newTaskDraft(danContact.id)
  );
  const [enabled, setEnabled] = useState(task?.enabled !== false);
  const status = task ? taskStatus({ ...task, enabled }) : undefined;
  const { destination } = draft;
  return (
    <AppDataContextProvider
      currentUserId={danContact.id}
      contacts={initialContacts}
    >
      <FullScreen>
        <RecurringTaskEditorView
          title={task ? 'Scheduled task' : 'New task'}
          draft={draft}
          onChange={setDraft}
          onBack={noop}
          disabled={status === 'held'}
          notice={
            status === 'held'
              ? 'This task is paused while your credits are limited. It starts again on its own when credits return. Changing it now would stop that.'
              : undefined
          }
          scheduleLabel={task ? formatAutomationSchedule(task) : undefined}
          timezone={
            task?.schedule?.kind === 'cron'
              ? task.schedule.tz
              : 'America/New_York'
          }
          destinationLabel={
            destination.kind === 'dm'
              ? 'Direct message to you'
              : destination.kind === 'channel'
                ? (destinationChannelChats.find(
                    ({ id }) => id === destination.nest
                  )?.channel.title ?? destination.nest)
                : 'Nowhere'
          }
          onSelectDestination={(channel) =>
            setDraft((current) => ({
              ...current,
              destination: { kind: 'channel', nest: channel.id },
            }))
          }
          destinationChannelChats={destinationChannelChats}
          status={
            status
              ? { value: status, busy: false, onChange: setEnabled }
              : undefined
          }
          save={{
            label: task ? 'Save' : 'Create',
            disabled: status === 'held',
            busy: false,
            onPress: noop,
          }}
          runs={
            task && runs
              ? {
                  subtitle: runHistorySubtitle(runs, runNow),
                  count: 24,
                  onPress: noop,
                  test: {
                    busy: false,
                    disabled: status === 'held',
                    onPress: noop,
                    note:
                      status === 'held'
                        ? 'Testing is paused while credits are limited.'
                        : 'A test run shows you what this task produces now. It posts nothing and leaves the schedule as it is.',
                  },
                }
              : undefined
          }
          onDelete={task ? noop : undefined}
        />
      </FullScreen>
    </AppDataContextProvider>
  );
}

function RunHistoryFixture({ runs }: { runs: ContextLens[] }) {
  return (
    <FullScreen>
      <TaskRunHistoryView
        taskName="Morning news summary"
        runs={runs}
        total={runs.length ? 24 : 0}
        now={runNow}
        hasMore={runs.length > 0}
        onLoadMore={noop}
        onPressRun={noop}
        onBack={noop}
        test={{ busy: false, onPress: noop }}
      />
    </FullScreen>
  );
}

function RunDetailFixture({ lensId }: { lensId: string | null }) {
  const lens = sampleRuns.find((run) => run.lensId === lensId) ?? null;
  return (
    <FullScreen>
      <TaskRunDetailView
        lens={lens}
        now={runNow}
        destinationLabel="Tlon · General"
        onBack={noop}
      />
    </FullScreen>
  );
}

const taskCardA2UI: A2UI.BlobEntry = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'recurring-task-card',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'recurring-task-card',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: ['eyebrow', 'title', 'schedule', 'divider', 'actions'],
          },
          {
            id: 'eyebrow',
            component: 'Text',
            variant: 'caption',
            text: 'RECURRING TASK · ACTIVE',
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h3',
            text: 'Morning news summary',
          },
          {
            id: 'schedule',
            component: 'Text',
            variant: 'caption',
            text: 'Every weekday at 7:00 · posts here',
          },
          { id: 'divider', component: 'Divider' },
          {
            id: 'actions',
            component: 'Row',
            children: ['view', 'notify'],
          },
          {
            id: 'view',
            component: 'Button',
            variant: 'secondary',
            child: 'view-label',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'Show me this scheduled task' },
              },
            },
          },
          { id: 'view-label', component: 'Text', text: 'View task' },
          {
            id: 'notify',
            component: 'Button',
            variant: 'borderless',
            child: 'notify-label',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'Notify me if this scheduled task fails' },
              },
            },
          },
          { id: 'notify-label', component: 'Text', text: 'Notify on failure' },
        ],
      },
    },
  ],
};

const now = Date.now();
const requestPost = makePost(
  danContact,
  [verse.inline('Can you set up the morning news digest we discussed?')],
  {
    channelId: botDmChannel.id,
    sentAt: now,
    receivedAt: now,
    replyCount: 0,
  }
);
const taskCardPost = makePost(
  botContact,
  [verse.inline('Done — the schedule is active.')],
  {
    sentAt: now + 1_000,
    receivedAt: now + 1_000,
    replyCount: 0,
    channelId: botDmChannel.id,
    blob: appendToPostBlob(undefined, taskCardA2UI),
  }
);
const resultRequestPost = makePost(
  danContact,
  [verse.inline('Did the morning news task run?')],
  {
    channelId: botDmChannel.id,
    sentAt: now,
    receivedAt: now,
    replyCount: 0,
  }
);
const resultPost = makePost(
  botContact,
  [
    verse.inline(
      'Five things this morning:\n\n— Port strike enters day four.\n— Appeals court narrows the chip export rule.\n— City council moved the budget vote.\n— Two grocery recalls were announced.\n— Rain arrives Thursday.'
    ),
  ],
  {
    channelId: botDmChannel.id,
    sentAt: now + 1_000,
    receivedAt: now + 1_000,
    replyCount: 0,
  }
);

function FixtureDraftProvider({ children }: PropsWithChildren) {
  const [shouldBlur, setShouldBlur] = useState(false);
  const value = useMemo<DraftInputContext>(
    () => ({
      canStartDraft: true,
      channel: botDmChannel,
      clearDraft: async () => {},
      configuration: {} as Record<string, JSONValue>,
      getDraft: async () => null,
      group,
      sendPostFromDraft: async () => {},
      setShouldBlur,
      shouldBlur,
      startDraft: noop,
      storeDraft: async (_content: JSONContent) => {},
    }),
    [shouldBlur]
  );

  return (
    <DraftInputContextProvider value={value}>
      {children}
    </DraftInputContextProvider>
  );
}

function ChannelStateFixture({ posts }: { posts: (typeof requestPost)[] }) {
  return (
    <ShipProvider
      initialShipInfo={{
        authType: 'hosted',
        ship: 'zod',
        shipUrl: 'https://zod.test',
        authCookie: 'fixture',
        needsSplashSequence: false,
      }}
    >
      <FullScreen>
        <ScreenHeader
          title={botContact.nickname}
          backAction={noop}
          rightActions={[
            { id: 'search', icon: 'Search', label: 'Search', onPress: noop },
          ]}
          placement="navigation"
        />
        <ChannelProvider value={{ channel: botDmChannel }}>
          <FixtureDraftProvider>
            <ScrollView
              flex={1}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: 'flex-end',
                paddingHorizontal: '$l',
                paddingVertical: '$2xl',
              }}
            >
              {posts.map((post) => (
                <View key={post.id} marginTop="$l">
                  <ChatMessage
                    post={post}
                    showAuthor={true}
                    showReplies={true}
                  />
                </View>
              ))}
            </ScrollView>
          </FixtureDraftProvider>
        </ChannelProvider>
      </FullScreen>
    </ShipProvider>
  );
}

export default {
  '1 · Bot profile': <BotProfileFixture />,
  '2 · Scheduled tasks': <TaskListFixture />,
  '2b · Empty state': <TaskListFixture empty />,
  '3 · Edit task': <TaskEditorFixture taskId="morning-news" />,
  '3b · New task': <TaskEditorFixture />,
  '3c · Schedule the editor cannot change': (
    <TaskEditorFixture taskId="unread-triage" />
  ),
  '3d · Paused for credits': <TaskEditorFixture taskId="ship-backup" />,
  '4 · Shared task card (A2UI)': (
    <ChannelStateFixture posts={[requestPost, taskCardPost]} />
  ),
  '5 · Run result (channel post)': (
    <ChannelStateFixture posts={[resultRequestPost, resultPost]} />
  ),
  '6 · Run history': <RunHistoryFixture runs={sampleRuns} />,
  '6b · Run history, empty': <RunHistoryFixture runs={[]} />,
  '7 · Test run, running': <RunDetailFixture lensId="test-now" />,
  '7b · Test run, finished': <RunDetailFixture lensId="test-earlier" />,
  '7c · Scheduled run, posted': <RunDetailFixture lensId="today" />,
  '7d · Scheduled run, failed': <RunDetailFixture lensId="yesterday" />,
};
