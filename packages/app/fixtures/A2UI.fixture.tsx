// tamagui-ignore
import type { JSONContent } from '@tloncorp/api/urbit';
import type { JSONValue } from '@tloncorp/shared';
import type { A2UI } from '@tloncorp/shared/logic';
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

const dmChannelId = '~sampel-palnet';

const weatherA2UI: A2UI.BlobEntry = {
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
              'tempDivider',
              'location',
              'description',
              'forecastDivider',
              'forecast-row',
            ],
          },
          {
            id: 'temp-row',
            component: 'Row',
            align: 'center',
            justify: 'center',
            children: ['temp-high-column', 'temp-low-column'],
          },
          {
            id: 'temp-high-column',
            component: 'Column',
            align: 'center',
            children: ['temp-high-label', 'temp-high'],
          },
          {
            id: 'temp-high-label',
            component: 'Text',
            variant: 'caption',
            text: 'High',
          },
          {
            id: 'temp-high',
            component: 'Text',
            variant: 'h1',
            text: '63°',
          },
          {
            id: 'temp-low-column',
            component: 'Column',
            align: 'center',
            children: ['temp-low-label', 'temp-low'],
          },
          {
            id: 'temp-low-label',
            component: 'Text',
            variant: 'caption',
            text: 'Low',
          },
          {
            id: 'temp-low',
            component: 'Text',
            variant: 'h1',
            text: '48°',
          },
          { id: 'tempDivider', component: 'Divider' },
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

function makeCompileRequestA2UI({
  surfaceId,
  title,
  metadata,
  copy,
}: {
  surfaceId: string;
  title: string;
  metadata: string[];
  copy: string;
}): A2UI.BlobEntry {
  const metadataChildren = metadata.map((_, index) => `metadata-${index}`);

  return {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId,
          catalogId: 'tlon.a2ui.basic.v1',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId,
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'main-column' },
            {
              id: 'main-column',
              component: 'Column',
              children: [
                'eyebrow',
                'title',
                'titleDivider',
                ...metadataChildren,
                'copy',
                'actions',
              ],
            },
            {
              id: 'eyebrow',
              component: 'Text',
              variant: 'caption',
              text: 'Lore compile request',
            },
            { id: 'title', component: 'Text', variant: 'h2', text: title },
            { id: 'titleDivider', component: 'Divider' },
            ...metadata.map(
              (line, index) =>
                ({
                  id: `metadata-${index}`,
                  component: 'Text',
                  variant: 'caption',
                  text: line,
                }) as const
            ),
            {
              id: 'copy',
              component: 'Text',
              variant: 'caption',
              text: copy,
            },
            {
              id: 'actions',
              component: 'Row',
              children: ['compile'],
            },
            {
              id: 'compile',
              component: 'Button',
              variant: 'primary',
              child: 'compileLabel',
              action: {
                event: {
                  name: 'tlon.poke',
                  context: {
                    app: 'a2ui',
                    mark: 'a2ui-action',
                    json: {
                      userAction: {
                        name: 'lore.compile.confirm',
                        surfaceId,
                        sourceComponentId: 'compile',
                      },
                      tlonContext: {
                        actionHostShip: '~malmur-halmex',
                        channelId: 'chat/~malmur-halmex/wjtysuq1-general',
                      },
                    },
                  },
                },
              },
            },
            { id: 'compileLabel', component: 'Text', text: 'Compile now' },
          ],
        },
      },
    ],
  };
}

const compileRequestA2UI = makeCompileRequestA2UI({
  surfaceId: 'lore-compile-request',
  title: 'New lore is ready to compile',
  metadata: ['Ingested: The Bitter Lesson', 'Channel: %lore Inbox'],
  copy: 'The source has been saved. Compile now to update the wiki and mirror fresh outputs.',
});

const basicComponentsA2UI: A2UI.BlobEntry = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'basic-components',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'basic-components',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: [
              'title',
              'intro',
              'textDivider',
              'textVariants',
              'layoutDivider',
              'layoutCard',
              'buttonDivider',
              'buttonRows',
            ],
          },
          {
            id: 'title',
            component: 'Text',
            variant: 'h3',
            text: 'Basic A2UI components',
          },
          {
            id: 'intro',
            component: 'Text',
            variant: 'caption',
            text: 'Supported presentation components in the initial Tlon renderer.',
          },
          { id: 'textDivider', component: 'Divider' },
          {
            id: 'textVariants',
            component: 'Column',
            children: [
              'textH1',
              'textH2',
              'textH3',
              'textH4',
              'textH5',
              'textBody',
              'textCaption',
            ],
          },
          { id: 'textH1', component: 'Text', variant: 'h1', text: 'Heading 1' },
          { id: 'textH2', component: 'Text', variant: 'h2', text: 'Heading 2' },
          { id: 'textH3', component: 'Text', variant: 'h3', text: 'Heading 3' },
          { id: 'textH4', component: 'Text', variant: 'h4', text: 'Heading 4' },
          { id: 'textH5', component: 'Text', variant: 'h5', text: 'Heading 5' },
          { id: 'textBody', component: 'Text', text: 'Body text' },
          {
            id: 'textCaption',
            component: 'Text',
            variant: 'caption',
            text: 'Caption text',
          },
          { id: 'layoutDivider', component: 'Divider' },
          { id: 'layoutCard', component: 'Card', child: 'layoutBody' },
          {
            id: 'layoutBody',
            component: 'Column',
            children: ['layoutTitle', 'rowStart', 'rowCenter', 'rowEnd'],
          },
          {
            id: 'layoutTitle',
            component: 'Text',
            variant: 'caption',
            text: 'Rows, columns, and nested cards',
          },
          {
            id: 'rowStart',
            component: 'Row',
            justify: 'spaceBetween',
            children: ['startLabel', 'startValue'],
          },
          { id: 'startLabel', component: 'Text', text: 'spaceBetween' },
          {
            id: 'startValue',
            component: 'Text',
            variant: 'caption',
            text: 'right edge',
          },
          {
            id: 'rowCenter',
            component: 'Row',
            align: 'center',
            justify: 'center',
            children: ['centerA', 'centerB'],
          },
          {
            id: 'centerA',
            component: 'Text',
            variant: 'caption',
            text: 'center',
          },
          { id: 'centerB', component: 'Text', text: 'aligned row' },
          {
            id: 'rowEnd',
            component: 'Row',
            justify: 'end',
            children: ['endLabel', 'endValue'],
          },
          {
            id: 'endLabel',
            component: 'Text',
            variant: 'caption',
            text: 'end',
          },
          { id: 'endValue', component: 'Text', text: 'aligned row' },
          { id: 'buttonDivider', component: 'Divider' },
          {
            id: 'buttonRows',
            component: 'Column',
            children: ['buttonRowOne', 'buttonRowTwo'],
          },
          {
            id: 'buttonRowOne',
            component: 'Row',
            children: ['primaryButton', 'secondaryButton', 'defaultButton'],
          },
          {
            id: 'primaryButton',
            component: 'Button',
            variant: 'primary',
            child: 'primaryLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'primary action' },
              },
            },
          },
          { id: 'primaryLabel', component: 'Text', text: 'Primary' },
          {
            id: 'secondaryButton',
            component: 'Button',
            variant: 'secondary',
            child: 'secondaryLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'secondary action' },
              },
            },
          },
          { id: 'secondaryLabel', component: 'Text', text: 'Secondary' },
          {
            id: 'defaultButton',
            component: 'Button',
            variant: 'default',
            child: 'defaultLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'default action' },
              },
            },
          },
          { id: 'defaultLabel', component: 'Text', text: 'Default' },
          {
            id: 'buttonRowTwo',
            component: 'Row',
            children: ['borderlessButton', 'disabledButton'],
          },
          {
            id: 'borderlessButton',
            component: 'Button',
            variant: 'borderless',
            child: 'borderlessLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'borderless action' },
              },
            },
          },
          { id: 'borderlessLabel', component: 'Text', text: 'Borderless' },
          {
            id: 'disabledButton',
            component: 'Button',
            disabled: true,
            child: 'disabledLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'disabled action' },
              },
            },
          },
          { id: 'disabledLabel', component: 'Text', text: 'Disabled' },
        ],
      },
    },
  ],
};

const weatherPost = makePost(
  exampleContacts.mark,
  [verse.inline('Weather: 22903 is 57F and partly cloudy.')],
  {
    blob: appendToPostBlob(undefined, weatherA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const compileRequestPost = makePost(
  exampleContacts.groupAdmin,
  [verse.inline('lore: ✓ “The Bitter Lesson” → AI & Technology notebook')],
  {
    blob: appendToPostBlob(undefined, compileRequestA2UI),
    channelId: tlonLocalIntros.id,
    replyCount: 0,
  }
);

const basicComponentsPost = makePost(
  exampleContacts.mark,
  [verse.inline('Basic A2UI component catalog.')],
  {
    blob: appendToPostBlob(undefined, basicComponentsA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const examplePosts = [weatherPost, compileRequestPost, basicComponentsPost];

function A2UIDraftProvider({
  canStartDraft = true,
  children,
}: PropsWithChildren<{ canStartDraft?: boolean }>) {
  const [shouldBlur, setShouldBlur] = useState(false);
  const draftContext = useMemo<DraftInputContext>(
    () => ({
      canStartDraft,
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
    [canStartDraft, shouldBlur]
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
              alignItems: 'flex-start',
              flexDirection: 'column',
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
            flex={1}
            contentContainerStyle={{
              alignItems: 'flex-start',
              flexDirection: 'column',
              paddingHorizontal: '$m',
              paddingVertical: '$2xl',
            }}
          >
            {examplePosts.map((post, index) => (
              <View
                key={post.id}
                maxWidth={520}
                width="100%"
                marginBottom={index === examplePosts.length - 1 ? 0 : '$l'}
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

function A2UIReadOnlyExamplesFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <ChannelProvider value={{ channel: tlonLocalIntros }}>
        <A2UIDraftProvider canStartDraft={false}>
          <ScrollView
            flex={1}
            contentContainerStyle={{
              alignItems: 'flex-start',
              flexDirection: 'column',
              paddingHorizontal: '$m',
              paddingVertical: '$2xl',
            }}
          >
            <View maxWidth={520} width="100%">
              <ChatMessage
                post={compileRequestPost}
                showAuthor={true}
                showReplies={true}
              />
            </View>
          </ScrollView>
        </A2UIDraftProvider>
      </ChannelProvider>
    </FixtureWrapper>
  );
}

export default {
  BasicComponents: () => <A2UIFixture post={basicComponentsPost} />,
  Weather: () => <A2UIFixture post={weatherPost} />,
  CompileRequest: () => <A2UIFixture post={compileRequestPost} />,
  Examples: () => <A2UIExamplesFixture />,
  ReadOnlyDisabledActions: () => <A2UIReadOnlyExamplesFixture />,
};
