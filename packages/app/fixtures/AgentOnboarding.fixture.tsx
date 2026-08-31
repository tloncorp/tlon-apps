// tamagui-ignore
import type { JSONContent } from '@tloncorp/api/urbit';
import { queryClient } from '@tloncorp/shared';
import type { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type { A2UI } from '@tloncorp/shared/logic';
import { TLON_A2UI_CATALOG_ID, appendToPostBlob } from '@tloncorp/shared/logic';
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
import { TLAWN_HOME_GROUP_WELCOME_MESSAGE } from '../ui/components/Channel/postVisibility';
import { ChannelFixture } from './Channel.fixture';
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
  `${TLAWN_HOME_GROUP_WELCOME_MESSAGE}\n\n` +
  'Let’s set up one useful recurring task. I’ll ask a few questions, then ' +
  'show you the plan.';
const AGENT_ONBOARDING_PURPOSE_PROMPT = 'What should I do for you regularly?';
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
  },
  {
    id: 'agent-learning',
    label: 'Learn something',
  },
  {
    id: 'agent-research',
    label: 'Research',
  },
] as const;

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
          catalogId: TLON_A2UI_CATALOG_ID,
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
    text: `${AGENT_ONBOARDING_GROUP_INTRO}\n\n${AGENT_ONBOARDING_PURPOSE_PROMPT}`,
  },
  {
    id: 'choices',
    component: 'SmallChoice',
    options: PURPOSE_PICKER_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
    })),
    submitLabel: 'Continue',
    freeTextPlaceholder: 'Describe your own…',
    action: {
      event: {
        name: 'tlon.sendMessage',
        context: { text: 'I want help with:' },
      },
    },
  } as A2UI.Component,
]);

const taskPlanSurface = makeA2UI('onboarding-task-plan-fixture', [
  {
    id: 'root',
    component: 'Column',
    children: ['summary', 'confirm'],
  },
  {
    id: 'summary',
    component: 'Text',
    text:
      'Battery research brief · every weekday at 8:30 AM · one concise, ' +
      'source-backed note covering material results from the last seven days.',
  },
  {
    id: 'confirm',
    component: 'Button',
    child: 'confirm-label',
    variant: 'primary',
    action: {
      event: {
        name: 'tlon.provisionAgent',
        context: {
          groupId,
          purposeId: 'agent-research',
          purpose: 'Research',
          topics: ['Battery materials'],
          scheduleHour: 8,
          scheduleMinute: 30,
          scheduleExpression: '30 8 * * 1-5',
          scheduleDescription: 'every weekday at 8:30 AM',
          taskPrompt:
            'Track material battery research from primary sources. Include ' +
            'only results published in the last seven days, explain practical ' +
            'implications, and link each source.',
        },
      },
    },
  } as A2UI.Component,
  {
    id: 'confirm-label',
    component: 'Text',
    text: 'Create this task',
  },
]);

const acknowledgement =
  'Got it. I’ll publish each result in Updates, this group’s notebook. After ' +
  'this first entry, the task will run every weekday at 8:30 AM.';
const firstEntryPending =
  'I’ll be back in a few seconds with your tailored post.';
const firstEntryReady =
  'Your first entry is ready in Updates, this group’s notebook. That notebook ' +
  'is where everything I write for you lands; this chat is for talking to me.';
const servicesPitch =
  'Connect your docs and notes and your morning digest can cover your own ' +
  'projects, not just the news.';
const servicesMessage = `${servicesPitch}\n\nPick anything you’d like, or tap Done to continue.`;
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
  completionLabel: 'Done',
  completionAction: {
    event: {
      name: 'tlon.sendMessage',
      context: { text: 'Done' },
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
  { displayName: 'AgentMail', id: 'agentmail', status: 'connected' },
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
    id: 'onboarding-01-purpose',
    author: tlonbot,
    text:
      `${AGENT_ONBOARDING_GROUP_INTRO}\n\n` +
      `${AGENT_ONBOARDING_PURPOSE_PROMPT} Choose “A daily digest”, “Learn something”, “Research”, or add your own idea.`,
    a2ui: purposePicker,
    minute: 1,
  }),
  transcriptPost({
    id: 'onboarding-03-purpose-reply',
    author: owner,
    text: 'I want help with: Research',
    minute: 3,
  }),
  transcriptPost({
    id: 'onboarding-04-focus-question',
    author: tlonbot,
    text: 'What field should I follow, and what would make an update worth including?',
    minute: 4,
  }),
  transcriptPost({
    id: 'onboarding-05-focus-reply',
    author: owner,
    text:
      'Battery materials. Only primary-source results from the last week, ' +
      'with practical implications.',
    minute: 5,
  }),
  transcriptPost({
    id: 'onboarding-06-schedule-question',
    author: tlonbot,
    text: 'How often should I publish it, and at what time?',
    minute: 6,
  }),
  transcriptPost({
    id: 'onboarding-07-schedule-reply',
    author: owner,
    text: 'Weekdays at 8:30 in the morning.',
    minute: 7,
  }),
  transcriptPost({
    id: 'onboarding-08-plan',
    author: tlonbot,
    text:
      'Battery research brief, every weekday at 8:30 AM, as one concise ' +
      'source-backed note. Tap Create this task to confirm.',
    a2ui: taskPlanSurface,
    minute: 8,
  }),
  transcriptPost({
    id: 'onboarding-09-plan-confirmed',
    author: owner,
    text: 'Battery materials',
    minute: 9,
  }),
  transcriptPost({
    id: 'onboarding-10-ack',
    author: tlonbot,
    text: acknowledgement,
    minute: 10,
  }),
  transcriptPost({
    id: 'onboarding-11-first-entry-pending',
    author: tlonbot,
    text: firstEntryPending,
    minute: 11,
  }),
  transcriptPost({
    id: 'onboarding-12-note-ready',
    author: tlonbot,
    text: firstEntryReady,
    minute: 12,
  }),
  transcriptPost({
    id: 'onboarding-13-services',
    author: tlonbot,
    text: servicesMessage,
    a2ui: servicesSurface,
    minute: 13,
  }),
  transcriptPost({
    id: 'onboarding-14-app-tour',
    author: tlonbot,
    text: `${AGENT_ONBOARDING_APP_TOUR_PROMPT} Yes or no.`,
    a2ui: appTourSurface,
    minute: 14,
  }),
  transcriptPost({
    id: 'onboarding-15-app-tour-yes',
    author: owner,
    text: 'Yes',
    minute: 15,
  }),
  transcriptPost({
    id: 'onboarding-16-bot-tour',
    author: tlonbot,
    text: `${AGENT_ONBOARDING_APP_TOUR_EXPLANATION}\n\n${AGENT_ONBOARDING_BOT_TOUR_PROMPT} Yes or no.`,
    a2ui: botTourSurface,
    minute: 16,
  }),
  transcriptPost({
    id: 'onboarding-17-bot-tour-yes',
    author: owner,
    text: 'Yes',
    minute: 17,
  }),
  transcriptPost({
    id: 'onboarding-18-bot-tour-complete',
    author: tlonbot,
    text: AGENT_ONBOARDING_BOT_TOUR_EXPLANATION,
    minute: 18,
  }),
];

const provisionedWelcomePost = transcriptPost({
  id: 'provisioned-tlawn-welcome',
  author: tlonbot,
  text: TLAWN_HOME_GROUP_WELCOME_MESSAGE,
  minute: 0,
});

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

function OnboardingConversation({ through = 3 }: { through?: number }) {
  return (
    <ChannelFixture
      theme="light"
      passedProps={() => ({
        channel: homeChannel,
        group: homeGroup,
        posts: [
          provisionedWelcomePost,
          ...transcript.slice(0, through),
        ].reverse(),
        suppressAnimatedSendScroll: true,
      })}
    />
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
            surfaceId="agent-services"
            onConfigure={() => {}}
            onComplete={() => {}}
            onNavigate={() => {}}
            providers={servicesPreviewProviders}
          />
        </View>
      </ScrollView>
    </FixtureWrapper>
  );
}

export default {
  'Agent-driven task starter': <OnboardingTranscript through={1} />,
  'Agent narrowing interview': <OnboardingTranscript through={6} />,
  'Owner-confirmable task plan': <OnboardingTranscript through={7} />,
  'Conversation combined opening': <OnboardingConversation through={1} />,
  'Conversation topic selection': <OnboardingConversation />,
  'Completed topic selection': <OnboardingTranscript through={4} />,
  'Durable completed conversation': <OnboardingTranscript />,
  'MCP services menu': <McpServicesPreview />,
};
