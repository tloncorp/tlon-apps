// tamagui-ignore
import type { JSONContent } from '@tloncorp/api/urbit';
import { queryClient } from '@tloncorp/shared';
import type { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type { A2UI } from '@tloncorp/shared/logic';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { useLureState } from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';

import type { McpProviderRow } from '../lib/mcpProviders';
import { ChatMessage, ScrollView, View } from '../ui';
import { McpConnectMenu } from '../ui/components/PostContent/McpConnectControl';
import {
  DraftInputContext,
  DraftInputContextProvider,
} from '../ui/components/draftInputs/shared';
import { ChannelProvider } from '../ui/contexts/channel';
import { FixtureWrapper } from './FixtureWrapper';
import { makePost, verse } from './contentHelpers';
import {
  emptyContact,
  group as fixtureGroup,
  tlonLocalIntros,
} from './fakeData';

// This fixture intentionally owns a representative transcript rather than
// making product copy part of the generic API package. The coordinator tests
// are authoritative for the actual emitted surfaces.
const AGENT_ONBOARDING_GROUP_INTRO =
  "I'm your Tlonbot. I can keep you informed, help you learn, or follow a " +
  'question over time.';
const AGENT_ONBOARDING_PURPOSE_PROMPT = 'What can I help you with?';
const AGENT_ONBOARDING_APP_TOUR_PROMPT =
  'Want me to tell you more about what you can do here?';
const AGENT_ONBOARDING_APP_TOUR_EXPLANATION =
  'Tlon is organized into groups. Each group can have chat channels for ' +
  'conversation and notebook channels for longer posts—like the update I ' +
  'just made for you. You can make more groups for different people or ' +
  'projects and bring me into the ones where you want help.';
const AGENT_ONBOARDING_BOT_TOUR_PROMPT =
  'Want me to tell you more about what Tlonbot can do for you?';
const AGENT_ONBOARDING_BOT_TOUR_EXPLANATION =
  'I can research questions, change what this group follows, publish ' +
  'scheduled updates, help in other groups, and use connected services you ' +
  'authorize. Try asking me to adjust tomorrow’s update or investigate ' +
  'something now.';
const PURPOSE_PICKER_OPTIONS = [
  {
    id: 'agent-daily-digest',
    label: 'A daily digest',
    description:
      'A short summary of anything you care about, posted every morning.',
    icon: 'ChannelNotebooks',
    accent: 'blue',
  },
  {
    id: 'agent-learning',
    label: 'Learn something',
    description: 'One idea each morning, taking your topics in turn.',
    icon: 'Clock',
    accent: 'green',
  },
  {
    id: 'agent-research',
    label: 'Research',
    description: 'A source-backed briefing that follows meaningful new work.',
    icon: 'Search',
    accent: 'indigo',
  },
] as const;
const DIGEST_PURPOSE = {
  id: 'agent-daily-digest',
  label: 'A daily digest',
  scheduleHour: 8,
  topicsPrompt:
    'A daily digest—great. What should I keep an eye on? Pick any that fit.',
  topics: [
    'Nootropics',
    'Longevity',
    'Psychedelics',
    'Open hardware',
    'Gene editing',
    'Space weather',
  ],
} as const;

const owner: db.Contact = {
  ...emptyContact,
  id: '~zod',
  nickname: 'Daniel',
  color: '#5B7CFF',
};

const tlonbot: db.Contact = {
  ...emptyContact,
  id: '~nec',
  nickname: 'Tlonbot',
  color: '#14A46F',
};

const groupId = '~zod/home-group';
const channelId = 'chat/~zod/home-group-chat';
const inviteUrl =
  'https://invite.tlon.io/0vsandbox--zod-home-group-onboarding-fixture';

const homeChannel: db.Channel = {
  ...tlonLocalIntros,
  id: channelId,
  groupId,
  title: 'Home',
};

const updatesNotebook: db.Channel = {
  ...homeChannel,
  id: 'notes/~zod/home-group-updates',
  type: 'notes',
  title: 'Updates',
};

const homeGroup: db.Group = {
  ...fixtureGroup,
  id: groupId,
  hostUserId: owner.id,
  currentUserIsHost: true,
  title: 'Open hardware + Space weather Digest',
  channels: [homeChannel, updatesNotebook],
  description: JSON.stringify([
    {
      type: 'tlon-group-agent-config',
      version: 1,
      templateId: 'agent-daily-digest',
      purpose: 'A daily digest',
      instructions: '',
      agents: [tlonbot.id],
      jobs: [{}],
      onboarding: {
        state: 'complete',
        topics: 'Open hardware, Space weather',
        timezone: 'America/New_York',
      },
      updatedAt: 1,
    },
  ]),
};

function action(text: string): A2UI.ButtonAction {
  return {
    event: { name: 'tlon.sendMessage', context: { text } },
  };
}

function makeA2UI(
  surfaceId: string,
  components: A2UI.Component[]
): A2UI.BlobEntry {
  return {
    type: 'a2ui',
    version: 1,
    storyMode: 'fallback',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: 'tlon.a2ui.basic.v2',
        },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId, root: 'root', components },
      },
    ],
  };
}

const purposePicker = makeA2UI('onboarding-purpose-fixture', [
  {
    id: 'root',
    component: 'Column',
    children: ['prompt', 'choices'],
  },
  {
    id: 'prompt',
    component: 'Text',
    text: AGENT_ONBOARDING_PURPOSE_PROMPT,
  },
  {
    id: 'choices',
    component: 'Choice',
    options: PURPOSE_PICKER_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
      icon: option.icon,
      accent: option.accent,
      action: action(option.label),
    })),
  } as A2UI.Component,
]);

const digestPurpose = DIGEST_PURPOSE;
const topics = [...digestPurpose.topics];

const topicsPicker = makeA2UI('onboarding-topics-fixture', [
  {
    id: 'root',
    component: 'Column',
    children: ['prompt', 'topics'],
  },
  {
    id: 'prompt',
    component: 'Text',
    text: digestPurpose.topicsPrompt,
  },
  {
    id: 'topics',
    component: 'SmallChoice',
    options: topics.map((topic) => ({
      id: topic.toLowerCase(),
      label: topic,
    })),
    submitLabel: 'That’s it',
    freeTextPlaceholder: 'Add your own…',
    action: {
      event: {
        name: 'tlon.provisionAgent',
        context: {
          groupId,
          purposeId: digestPurpose.id,
          purpose: digestPurpose.label,
          topics,
          scheduleHour: digestPurpose.scheduleHour,
          scheduleMinute: 0,
          notebookNest: updatesNotebook.id,
          notebookTitle: updatesNotebook.title,
        },
      },
    },
  } as A2UI.Component,
]);

const acknowledgement =
  'Open hardware and Space weather—got it. Every morning I’ll write a fresh ' +
  'digest in Updates, this group’s notebook. After this first entry, new ones ' +
  'arrive at 8:00 AM.';
const firstEntryPending =
  'I’m writing the first entry now. You’re all set—feel free to explore while I work.';
const firstEntryReady =
  'Your first entry is ready in Updates, this group’s notebook. That notebook ' +
  'is where everything I write for you lands; this chat is for talking to me.';
const servicesMessage =
  'Connect your calendar and docs and your morning digest can cover your own ' +
  'day — meetings, deadlines, notes — not just the news.';
const servicesComponent: A2UI.McpConnect = {
  id: 'providers',
  component: 'McpConnect',
  maxVisible: 4,
  seeAllLabel: 'See all connectors',
  submitLabel: 'Use for this group',
  action: {
    event: {
      name: 'tlon.navigate',
      context: { target: { type: 'screen', screen: 'botMcpSettings' } },
    },
  },
  configureAction: {
    event: {
      name: 'tlon.configureAgentProviders',
      context: {
        groupId: homeGroup.id,
        provisionId: 'fixture-provision',
        providerIds: [],
      },
    },
  },
};
const servicesSurface = makeA2UI('onboarding-services-fixture', [
  { id: 'root', component: 'Column', children: ['benefit', 'providers'] },
  { id: 'benefit', component: 'Text', text: servicesMessage },
  servicesComponent,
]);

const servicesPreviewProviders: McpProviderRow[] = [
  { displayName: 'Notion', id: 'notion', status: 'connected' },
  {
    displayName: 'Google Calendar',
    id: 'google-calendar',
    status: 'connected',
  },
  { displayName: 'Gmail', id: 'gmail', status: 'not-connected' },
  { displayName: 'GitHub', id: 'github', status: 'not-connected' },
  { displayName: 'Linear', id: 'linear', status: 'not-connected' },
  { displayName: 'Airtable', id: 'airtable', status: 'not-connected' },
  { displayName: 'Sentry', id: 'sentry', status: 'not-connected' },
  { displayName: 'PostHog', id: 'posthog', status: 'not-connected' },
  { displayName: 'Atlassian', id: 'atlassian', status: 'not-connected' },
  { displayName: 'Are.na', id: 'arena', status: 'not-connected' },
];

function tourSurface(id: string, prompt: string) {
  return makeA2UI(id, [
    {
      id: 'root',
      component: 'Column',
      children: ['prompt', 'choice'],
    },
    { id: 'prompt', component: 'Text', text: prompt },
    {
      id: 'choice',
      component: 'Choice',
      options: [
        { id: 'yes', label: 'Yes', action: action('Yes') },
        { id: 'no', label: 'No', action: action('No') },
      ],
    },
  ] as A2UI.Component[]);
}

const appTourSurface = tourSurface(
  'onboarding-app-tour-fixture',
  AGENT_ONBOARDING_APP_TOUR_PROMPT
);
const botTourSurface = tourSurface(
  'onboarding-bot-tour-fixture',
  `${AGENT_ONBOARDING_APP_TOUR_EXPLANATION}\n\n${AGENT_ONBOARDING_BOT_TOUR_PROMPT}`
);

function transcriptPost({
  id,
  author,
  text,
  a2ui,
  minute,
}: {
  id: string;
  author: db.Contact;
  text: string;
  a2ui?: A2UI.BlobEntry;
  minute: number;
}) {
  const sentAt = Date.UTC(2026, 7, 11, 13, minute);
  return makePost(author, [verse.inline(text)], {
    id,
    sentAt,
    receivedAt: sentAt,
    channelId,
    groupId,
    replyCount: 0,
    isBot: author.id === tlonbot.id,
    blob: a2ui ? appendToPostBlob(undefined, a2ui) : undefined,
  });
}

const transcript = [
  transcriptPost({
    id: 'onboarding-01-intro',
    author: tlonbot,
    text: AGENT_ONBOARDING_GROUP_INTRO,
    minute: 1,
  }),
  transcriptPost({
    id: 'onboarding-02-purpose',
    author: tlonbot,
    text: `${AGENT_ONBOARDING_PURPOSE_PROMPT} Reply “A daily digest”, “Learn something”, or “Research”.`,
    a2ui: purposePicker,
    minute: 2,
  }),
  transcriptPost({
    id: 'onboarding-03-purpose-reply',
    author: owner,
    text: 'A daily digest',
    minute: 3,
  }),
  transcriptPost({
    id: 'onboarding-04-topics',
    author: tlonbot,
    text: `${digestPurpose.topicsPrompt} ${topics.join(', ')}.`,
    a2ui: topicsPicker,
    minute: 4,
  }),
  transcriptPost({
    id: 'onboarding-05-topics-reply',
    author: owner,
    text: 'Open hardware, Space weather',
    minute: 5,
  }),
  transcriptPost({
    id: 'onboarding-06-ack',
    author: tlonbot,
    text: acknowledgement,
    minute: 6,
  }),
  transcriptPost({
    id: 'onboarding-07-first-entry-pending',
    author: tlonbot,
    text: firstEntryPending,
    minute: 7,
  }),
  transcriptPost({
    id: 'onboarding-08-note-ready',
    author: tlonbot,
    text: firstEntryReady,
    minute: 8,
  }),
  transcriptPost({
    id: 'onboarding-09-services',
    author: tlonbot,
    text: `${servicesMessage}\n\nConnect services in Settings.`,
    a2ui: servicesSurface,
    minute: 9,
  }),
  transcriptPost({
    id: 'onboarding-10-app-tour',
    author: tlonbot,
    text: `${AGENT_ONBOARDING_APP_TOUR_PROMPT} Yes or no.`,
    a2ui: appTourSurface,
    minute: 10,
  }),
  transcriptPost({
    id: 'onboarding-11-app-tour-yes',
    author: owner,
    text: 'Yes',
    minute: 11,
  }),
  transcriptPost({
    id: 'onboarding-12-bot-tour',
    author: tlonbot,
    text: `${AGENT_ONBOARDING_APP_TOUR_EXPLANATION}\n\n${AGENT_ONBOARDING_BOT_TOUR_PROMPT} Yes or no.`,
    a2ui: botTourSurface,
    minute: 12,
  }),
  transcriptPost({
    id: 'onboarding-13-bot-tour-yes',
    author: owner,
    text: 'Yes',
    minute: 13,
  }),
  transcriptPost({
    id: 'onboarding-14-bot-tour-complete',
    author: tlonbot,
    text: AGENT_ONBOARDING_BOT_TOUR_EXPLANATION,
    minute: 14,
  }),
];

function OnboardingDraftProvider({ children }: PropsWithChildren) {
  const [shouldBlur, setShouldBlur] = useState(false);
  const draftContext = useMemo<DraftInputContext>(
    () => ({
      canStartDraft: true,
      channel: homeChannel,
      clearDraft: async () => {},
      configuration: {} as Record<string, JSONValue>,
      getDraft: async () => null,
      group: homeGroup,
      sendPostFromDraft: async () => {},
      setShouldBlur,
      shouldBlur,
      startDraft: () => {},
      storeDraft: async (_content: JSONContent) => {},
    }),
    [shouldBlur]
  );

  return (
    <DraftInputContextProvider value={draftContext}>
      {children}
    </DraftInputContextProvider>
  );
}

function FixtureData({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    useLureState.setState((state) => ({
      ...state,
      bait: { ship: owner.id, url: inviteUrl },
      lures: {
        ...state.lures,
        [groupId]: {
          fetched: true,
          url: inviteUrl,
          deepLinkUrl: inviteUrl,
        },
      },
    }));
    void db.agentGroupAgents
      .setValue((current) => ({
        ...current,
        [groupId]: tlonbot.id,
      }))
      .then(() => db.insertGroups({ groups: [homeGroup] }))
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: [['group', groupId]] });
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return ready ? children : null;
}

function OnboardingTranscript({
  through = transcript.length,
}: {
  through?: number;
}) {
  const visibleTranscript = transcript.slice(0, through);
  return (
    <FixtureWrapper fillWidth fillHeight>
      <FixtureData>
        <ChannelProvider value={{ channel: homeChannel }}>
          <OnboardingDraftProvider>
            <ScrollView
              flex={1}
              contentContainerStyle={{
                alignItems: 'flex-start',
                flexDirection: 'column',
                paddingHorizontal: '$m',
                paddingVertical: '$2xl',
              }}
            >
              <View maxWidth={560} width="100%">
                {visibleTranscript.map((post, index) => {
                  const previous = visibleTranscript[index - 1];
                  const showAuthor = previous?.authorId !== post.authorId;
                  return (
                    <View
                      key={post.id}
                      marginBottom={
                        index === visibleTranscript.length - 1
                          ? 0
                          : showAuthor
                            ? '$l'
                            : '$s'
                      }
                    >
                      <ChatMessage
                        post={post}
                        showAuthor={showAuthor}
                        showReplies={false}
                        hideOverflowMenu
                      />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </OnboardingDraftProvider>
        </ChannelProvider>
      </FixtureData>
    </FixtureWrapper>
  );
}

function McpServicesPreview() {
  return (
    <FixtureWrapper fillHeight fillWidth safeArea verticalAlign="top">
      <ScrollView
        flex={1}
        contentContainerStyle={{
          alignItems: 'flex-start',
          paddingHorizontal: '$m',
          paddingVertical: '$2xl',
        }}
      >
        <View maxWidth={560} width="100%" gap="$m">
          <Text size="$body" color="$primaryText" trimmed={false}>
            {servicesMessage}
          </Text>
          <McpConnectMenu
            component={servicesComponent}
            onConfigure={() => {}}
            onNavigate={() => {}}
            providers={servicesPreviewProviders}
          />
        </View>
      </ScrollView>
    </FixtureWrapper>
  );
}

export default {
  'Durable purpose selection': <OnboardingTranscript through={2} />,
  'Durable topic selection': <OnboardingTranscript through={4} />,
  'Durable completed conversation': <OnboardingTranscript />,
  'MCP services menu': <McpServicesPreview />,
};
