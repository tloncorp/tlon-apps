// tamagui-ignore
import type { JSONContent } from '@tloncorp/api/urbit';
import type { JSONValue } from '@tloncorp/shared';
import type { PostBlobDataEntryA2UI } from '@tloncorp/shared/logic';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import React, { PropsWithChildren, useMemo, useState } from 'react';

import { ChatMessage, ScrollView, View } from '../ui';
import {
  DraftInputContext,
  DraftInputContextProvider,
} from '../ui/components/draftInputs/shared';
import { ChannelProvider } from '../ui/contexts/channel';
import { FixtureWrapper } from './FixtureWrapper';
import { exampleContacts, makePost, verse } from './contentHelpers';
import { group, tlonLocalIntros } from './fakeData';

const weatherA2UI: PostBlobDataEntryA2UI = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'weather-brooklyn',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'weather-brooklyn',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'main-column' },
          {
            id: 'main-column',
            component: 'Column',
            align: 'center',
            children: [
              'temp-row',
              'location',
              'description',
              'forecastDivider',
              'forecast-row',
            ],
          },
          {
            id: 'temp-row',
            component: 'Row',
            align: 'start',
            children: ['temp-high', 'temp-low'],
          },
          {
            id: 'temp-high',
            component: 'Text',
            variant: 'h1',
            text: '63°',
          },
          {
            id: 'temp-low',
            component: 'Text',
            variant: 'h2',
            text: '48°',
          },
          {
            id: 'location',
            component: 'Text',
            variant: 'h3',
            text: '22903 (Charlottesville, VA)',
          },
          {
            id: 'description',
            component: 'Text',
            variant: 'caption',
            text: 'Partly cloudy · Humidity 76%, Wind 3 mph',
          },
          { id: 'forecastDivider', component: 'Divider' },
          {
            id: 'forecast-row',
            component: 'Row',
            align: 'center',
            justify: 'spaceAround',
            children: ['today', 'tomorrow', 'next'],
          },
          {
            id: 'today',
            component: 'Column',
            align: 'center',
            weight: 1,
            children: ['todayLabel', 'todayIcon', 'todayTemp'],
          },
          {
            id: 'todayLabel',
            component: 'Text',
            variant: 'caption',
            text: 'Today',
          },
          { id: 'todayIcon', component: 'Text', variant: 'h2', text: '🌧️' },
          {
            id: 'todayTemp',
            component: 'Text',
            variant: 'caption',
            text: '63°',
          },
          {
            id: 'tomorrow',
            component: 'Column',
            align: 'center',
            weight: 1,
            children: ['tomorrowLabel', 'tomorrowIcon', 'tomorrowTemp'],
          },
          {
            id: 'tomorrowLabel',
            component: 'Text',
            variant: 'caption',
            text: 'Wed',
          },
          { id: 'tomorrowIcon', component: 'Text', variant: 'h2', text: '☁️' },
          {
            id: 'tomorrowTemp',
            component: 'Text',
            variant: 'caption',
            text: '74°',
          },
          {
            id: 'next',
            component: 'Column',
            align: 'center',
            weight: 1,
            children: ['nextLabel', 'nextIcon', 'nextTemp'],
          },
          {
            id: 'nextLabel',
            component: 'Text',
            variant: 'caption',
            text: 'Thu',
          },
          { id: 'nextIcon', component: 'Text', variant: 'h2', text: '🌧️' },
          {
            id: 'nextTemp',
            component: 'Text',
            variant: 'caption',
            text: '75°',
          },
        ],
      },
    },
  ],
};

const confirmationA2UI: PostBlobDataEntryA2UI = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'confirm-dm-zod',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'confirm-dm-zod',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: [
              'eyebrow',
              'title',
              'copy',
              'divider',
              'details',
              'actions',
            ],
          },
          {
            id: 'eyebrow',
            component: 'Text',
            variant: 'caption',
            text: 'Approval needed',
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h3',
            text: 'Allow DM from ~zod?',
          },
          {
            id: 'copy',
            component: 'Text',
            text: 'This ship wants to start a direct message.',
          },
          { id: 'divider', component: 'Divider' },
          {
            id: 'details',
            component: 'Column',
            children: ['requester', 'note'],
          },
          {
            id: 'requester',
            component: 'Text',
            variant: 'caption',
            text: 'Requester: ~zod',
          },
          {
            id: 'note',
            component: 'Text',
            variant: 'caption',
            text: 'Approve to open a DM, or decline to ignore the request.',
          },
          {
            id: 'actions',
            component: 'Row',
            children: ['approve', 'decline', 'block'],
          },
          {
            id: 'approve',
            component: 'Button',
            variant: 'primary',
            child: 'approveLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'approve dm ~zod' },
              },
            },
          },
          { id: 'approveLabel', component: 'Text', text: 'Approve' },
          {
            id: 'decline',
            component: 'Button',
            child: 'declineLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'decline dm ~zod' },
              },
            },
          },
          { id: 'declineLabel', component: 'Text', text: 'Decline' },
          {
            id: 'block',
            component: 'Button',
            variant: 'borderless',
            child: 'blockLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'block dm ~zod' },
              },
            },
          },
          { id: 'blockLabel', component: 'Text', text: 'Block' },
        ],
      },
    },
  ],
};

const buildStatusA2UI: PostBlobDataEntryA2UI = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'build-status',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'build-status',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: ['eyebrow', 'title', 'copy', 'divider', 'meta', 'action'],
          },
          {
            id: 'eyebrow',
            component: 'Text',
            variant: 'caption',
            text: 'Deploy preview',
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h3',
            text: 'Ready for review',
          },
          {
            id: 'copy',
            component: 'Text',
            text: 'The latest web build passed checks and is available to inspect.',
          },
          { id: 'divider', component: 'Divider' },
          {
            id: 'meta',
            component: 'Column',
            children: ['branch', 'runtime'],
          },
          {
            id: 'branch',
            component: 'Text',
            variant: 'caption',
            text: 'Branch: db/a2ui-v1',
          },
          {
            id: 'runtime',
            component: 'Text',
            variant: 'caption',
            text: 'Runtime: web · light theme',
          },
          {
            id: 'action',
            component: 'Button',
            variant: 'primary',
            child: 'actionLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'open deploy preview' },
              },
            },
          },
          { id: 'actionLabel', component: 'Text', text: 'Open preview' },
        ],
      },
    },
  ],
};

const meetingA2UI: PostBlobDataEntryA2UI = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'meeting-summary',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'meeting-summary',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: ['title', 'copy', 'divider', 'notes', 'actions'],
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h3',
            text: 'Design sync',
          },
          {
            id: 'copy',
            component: 'Text',
            text: 'Three notes were captured from the A2UI discussion.',
          },
          { id: 'divider', component: 'Divider' },
          {
            id: 'notes',
            component: 'Column',
            children: ['noteOne', 'noteTwo', 'noteThree'],
          },
          {
            id: 'noteOne',
            component: 'Text',
            variant: 'caption',
            text: '1. Start with presentation-only rendering.',
          },
          {
            id: 'noteTwo',
            component: 'Text',
            variant: 'caption',
            text: '2. Use event actions for buttons.',
          },
          {
            id: 'noteThree',
            component: 'Text',
            variant: 'caption',
            text: '3. Keep server expansion as a later phase.',
          },
          {
            id: 'actions',
            component: 'Row',
            children: ['save', 'dismiss'],
          },
          {
            id: 'save',
            component: 'Button',
            variant: 'primary',
            child: 'saveLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'save design sync notes' },
              },
            },
          },
          { id: 'saveLabel', component: 'Text', text: 'Save' },
          {
            id: 'dismiss',
            component: 'Button',
            variant: 'borderless',
            child: 'dismissLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'dismiss design sync notes' },
              },
            },
          },
          { id: 'dismissLabel', component: 'Text', text: 'Dismiss' },
        ],
      },
    },
  ],
};

const scoreA2UI: PostBlobDataEntryA2UI = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'score-summary',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'score-summary',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            align: 'center',
            children: ['eyebrow', 'scoreRow', 'divider', 'summary'],
          },
          {
            id: 'eyebrow',
            component: 'Text',
            variant: 'caption',
            text: 'Final',
          },
          {
            id: 'scoreRow',
            component: 'Row',
            align: 'center',
            justify: 'center',
            children: ['home', 'dash', 'away'],
          },
          {
            id: 'home',
            component: 'Text',
            variant: 'h2',
            text: 'Tlon 4',
          },
          { id: 'dash', component: 'Text', variant: 'caption', text: 'vs' },
          {
            id: 'away',
            component: 'Text',
            variant: 'h2',
            text: 'Mars 2',
          },
          { id: 'divider', component: 'Divider' },
          {
            id: 'summary',
            component: 'Text',
            variant: 'caption',
            text: 'Two goals in the final minute sealed it.',
          },
        ],
      },
    },
  ],
};

const weatherPost = makePost(
  exampleContacts.mark,
  [verse.inline('Weather: 22903 is 57F and partly cloudy.')],
  { blob: appendToPostBlob(undefined, weatherA2UI), replyCount: 0 }
);

const confirmationPost = makePost(
  exampleContacts.groupAdmin,
  [verse.inline('Allow DM from ~zod?')],
  { blob: appendToPostBlob(undefined, confirmationA2UI), replyCount: 0 }
);

const buildStatusPost = makePost(
  exampleContacts.mark,
  [verse.inline('Deploy preview is ready.')],
  { blob: appendToPostBlob(undefined, buildStatusA2UI), replyCount: 0 }
);

const meetingPost = makePost(
  exampleContacts.groupAdmin,
  [verse.inline('Design sync notes captured.')],
  { blob: appendToPostBlob(undefined, meetingA2UI), replyCount: 0 }
);

const scorePost = makePost(
  exampleContacts.mark,
  [verse.inline('Final score: Tlon 4, Mars 2.')],
  { blob: appendToPostBlob(undefined, scoreA2UI), replyCount: 0 }
);

const examplePosts = [
  weatherPost,
  confirmationPost,
  buildStatusPost,
  meetingPost,
  scorePost,
];

function A2UIDraftProvider({ children }: PropsWithChildren) {
  const [shouldBlur, setShouldBlur] = useState(false);
  const draftContext = useMemo<DraftInputContext>(
    () => ({
      canStartDraft: true,
      channel: tlonLocalIntros,
      clearDraft: async () => {},
      configuration: {} as Record<string, JSONValue>,
      getDraft: async () => null,
      group,
      sendPostFromDraft: async (draft) => {
        alert(
          draft.content
            .map((item) => (typeof item === 'string' ? item : ''))
            .join('')
        );
      },
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

function A2UIFixture({ post }: { post: typeof weatherPost }) {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <ChannelProvider value={{ channel: tlonLocalIntros }}>
        <A2UIDraftProvider>
          <ScrollView
            flex={1}
            contentContainerStyle={{
              paddingHorizontal: '$m',
              paddingVertical: '$2xl',
            }}
          >
            <View maxWidth={520} width="100%">
              <ChatMessage post={post} showAuthor={true} showReplies={true} />
            </View>
          </ScrollView>
        </A2UIDraftProvider>
      </ChannelProvider>
    </FixtureWrapper>
  );
}

function A2UIExamplesFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <ChannelProvider value={{ channel: tlonLocalIntros }}>
        <A2UIDraftProvider>
          <ScrollView
            horizontal
            flex={1}
            contentContainerStyle={{
              paddingHorizontal: '$m',
              paddingVertical: '$2xl',
            }}
          >
            {examplePosts.map((post, index) => (
              <View
                key={post.id}
                width={280}
                marginRight={index === examplePosts.length - 1 ? '$m' : '$l'}
              >
                <ChatMessage post={post} showAuthor={true} showReplies={true} />
              </View>
            ))}
          </ScrollView>
        </A2UIDraftProvider>
      </ChannelProvider>
    </FixtureWrapper>
  );
}

export default {
  Weather: () => <A2UIFixture post={weatherPost} />,
  ConfirmationDialog: () => <A2UIFixture post={confirmationPost} />,
  Examples: () => <A2UIExamplesFixture />,
};
