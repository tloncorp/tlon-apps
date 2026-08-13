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
  title: 'Home',
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
    text: "Let's set up your first group. What should it do?",
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
        id: 'agent-tracking',
        label: 'Tracking',
        description:
          'You log a thing as it happens. I keep the running picture over time.',
        icon: 'Clock',
        accent: 'green',
        action: action('Tracking'),
      },
      {
        id: 'agent-research',
        label: 'Research',
        description:
          'A standing deep-dive I keep updated as new work comes out.',
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
    text:
      'Good. I’ll create a group that posts a fresh morning digest about ' +
      'whatever you choose. What should it cover? Pick any that fit.',
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
        },
      },
    },
  } as A2UI.Component,
]);

const servicesCard = makeA2UI('onboarding-services-fixture', [
  {
    id: 'root',
    component: 'Button',
    variant: 'primary',
    child: 'connectLabel',
    action: {
      event: {
        name: 'tlon.navigate',
        context: { target: { type: 'screen', screen: 'botMcpSettings' } },
      },
    },
  } as A2UI.Component,
  { id: 'connectLabel', component: 'Text', text: 'Connect services' },
]);

const intro =
  "I'm your Tlonbot. I can research things, track changes, and write updates for you.";

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
    text: "Let's set up your first group. What should it do? Reply “A daily digest”, “Tracking”, “Research” — or just tell me.",
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
    text: 'Good. I’ll create a group that posts a fresh morning digest about whatever you choose. What should it cover? Pick any that fit. Nootropics, Longevity, Psychedelics, Open hardware, Gene editing, Space weather, Fusion, Homesteading — You can also just tell me here in the chat.',
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
    text: 'Open hardware and Space weather—got it. You’re all set — your first entry is coming shortly.',
    minute: 6,
  }),
  transcriptPost({
    id: 'onboarding-07-closing',
    author: tlonbot,
    text: 'A few things to know:\n\n- This conversation stays with you if you switch models or move Tlon to your own server.\n- You can rename me whenever you like.\n- Ask me about anything I find, or tell me what to do next.\n\nI can draw on more than the web. Connect your other services — calendars, docs, notes — and what they know flows into these digests too:',
    minute: 7,
  }),
  transcriptPost({
    id: 'onboarding-08-services',
    author: tlonbot,
    text: 'Connect services in Settings.',
    a2ui: servicesCard,
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
