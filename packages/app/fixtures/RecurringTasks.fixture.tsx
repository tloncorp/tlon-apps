import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { JSONContent } from '@tloncorp/api/urbit';
import type { JSONValue } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/db';
import type { A2UI } from '@tloncorp/shared/logic';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { Image } from 'react-native';
import { View, useTheme } from 'tamagui';

import { ShipProvider } from '../contexts/ship';
import { nativeHeaderPresentationOptions } from '../navigation/nativeHeaderOptions';
import {
  AppDataContextProvider,
  ChatMessage,
  type IdentifiedAutomationTask,
  type RecurringTaskDraft,
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
  avatarImage: Image.resolveAssetSource(require('../ui/assets/raster/bot.png'))
    .uri,
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
    },
  },
  {
    id: 'ship-backup',
    task: {
      name: 'Ship backup check',
      enabled: true,
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
    },
  },
  {
    id: 'unread-triage',
    task: {
      name: 'Unread triage',
      enabled: true,
      schedule: { kind: 'every', everyMs: 4 * 60 * 60 * 1000 },
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

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <FixtureWrapper fillHeight fillWidth verticalAlign="top">
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
            placement="navigation"
          />
          <UserProfileScreenView
            userId={botContact.id}
            connectionStatus={{ complete: true, status: 'yes' }}
            onPressBotSettings={noop}
            onPressScheduledTasks={noop}
            scheduledTaskCount={taskDefinitions.length}
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
        canMutate={false}
        onBack={noop}
      />
    </FullScreen>
  );
}

const initialDraft: RecurringTaskDraft = {
  name: 'Morning news summary',
  prompt:
    "Summarize today's news in five bullets. Link every source. Skip sports.",
  repeat: 'Weekly',
  selectedDays: [1, 2, 3, 4, 5],
  timeLabel: '7:00 AM',
  destinationLabel: 'General',
};

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
  id: channel.id,
  type: 'channel',
  channel: {
    ...channel,
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

function TaskEditorFixture() {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <AppDataContextProvider
      currentUserId={danContact.id}
      contacts={initialContacts}
    >
      <FullScreen>
        <RecurringTaskEditorView
          draft={draft}
          readOnly={false}
          onChange={setDraft}
          onBack={noop}
          onAutosave={noop}
          destinationChannelChats={destinationChannelChats}
        />
      </FullScreen>
    </AppDataContextProvider>
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
  '3 · Definition editor': <TaskEditorFixture />,
  '4 · Shared task card (A2UI)': (
    <ChannelStateFixture posts={[requestPost, taskCardPost]} />
  ),
  '5 · Run result (channel post)': (
    <ChannelStateFixture posts={[resultRequestPost, resultPost]} />
  ),
};
