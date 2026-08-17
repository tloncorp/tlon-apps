// tamagui-ignore
import type { JSONContent } from '@tloncorp/api/urbit';
import { queryClient } from '@tloncorp/shared';
import type { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import type { A2UI } from '@tloncorp/shared/logic';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { useLureState } from '@tloncorp/shared/store';
import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { ChatMessage, ScrollView, View } from '../ui';
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
    text: 'What would be useful for this group?',
  },
  {
    id: 'choices',
    component: 'Choice',
    options: [
      {
        id: 'agent-daily-digest',
        label: 'A daily digest',
        description:
          'A short summary of anything you care about, posted every morning.',
        icon: 'ChannelNotebooks',
        accent: 'blue',
        action: action('A daily digest'),
      },
      {
        id: 'agent-learning',
        label: 'Learn something',
        description:
          'A short daily idea that builds your understanding over time.',
        icon: 'Clock',
        accent: 'green',
        action: action('Learn something'),
      },
      {
        id: 'agent-research',
        label: 'Research',
        description:
          'A source-backed briefing that follows meaningful new work.',
        icon: 'Search',
        accent: 'indigo',
        action: action('Research'),
      },
    ],
  } as A2UI.Component,
]);

const topics = [
  'Nootropics',
  'Longevity',
  'Psychedelics',
  'Open hardware',
  'Gene editing',
  'Space weather',
  'Fusion',
  'Homesteading',
];

const topicsPicker = makeA2UI('onboarding-topics-fixture', [
  {
    id: 'root',
    component: 'Column',
    children: ['prompt', 'topics'],
  },
  {
    id: 'prompt',
    component: 'Text',
    text: 'A daily digest—great. What should I keep an eye on? Pick any that fit.',
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
          purposeId: 'agent-daily-digest',
          purpose: 'A daily digest',
          topics,
          scheduleHour: 8,
          scheduleMinute: 0,
          notebookNest: updatesNotebook.id,
          notebookTitle: updatesNotebook.title,
        },
      },
    },
  } as A2UI.Component,
]);

const acknowledgement =
  'Open hardware and Space weather—got it. Each morning, I’ll add one fresh ' +
  'digest to Updates, the notebook channel in this group. Notebook channels ' +
  'keep longer entries organized so they don’t get buried in chat. I’m ' +
  'working on the first one now. You’re all set—feel free to look around.';
const servicesMessage =
  'Want future updates to include your own schedule and work? Connect your ' +
  'calendar, documents, or notes, and I can use them alongside the public web:';
const servicesSurface = makeA2UI('onboarding-services-fixture', [
  { id: 'root', component: 'Column', children: ['benefit', 'action'] },
  { id: 'benefit', component: 'Text', text: servicesMessage },
  {
    id: 'action',
    component: 'Button',
    variant: 'primary',
    child: 'servicesLabel',
    action: {
      event: {
        name: 'tlon.navigate',
        context: { target: { type: 'screen', screen: 'botMcpSettings' } },
      },
    },
  } as A2UI.Component,
  { id: 'servicesLabel', component: 'Text', text: 'Connect services' },
]);

const intro =
  "I'm your Tlonbot. I can keep you informed, help you learn, or follow a question over time.";

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
    text: intro,
    minute: 1,
  }),
  transcriptPost({
    id: 'onboarding-02-purpose',
    author: tlonbot,
    text: 'What would be useful for this group? Reply “A daily digest”, “Learn something”, or “Research”.',
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
    text: 'A daily digest—great. What should I keep an eye on? Pick any that fit. Nootropics, Longevity, Psychedelics, Open hardware, Gene editing, Space weather, Fusion, Homesteading.',
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
    id: 'onboarding-07-note-ready',
    author: tlonbot,
    text: 'Your first note is ready in Updates:',
    minute: 7,
  }),
  transcriptPost({
    id: 'onboarding-08-services',
    author: tlonbot,
    text: `${servicesMessage}\n\nConnect services in Settings.`,
    a2ui: servicesSurface,
    minute: 8,
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

export default {
  'Durable purpose selection': <OnboardingTranscript through={2} />,
  'Durable topic selection': <OnboardingTranscript through={4} />,
  'Durable completed conversation': <OnboardingTranscript />,
};
