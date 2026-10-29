// tamagui-ignore
import type { JSONContent } from '@tloncorp/api/urbit';
import type { JSONValue } from '@tloncorp/shared';
import type { A2UI } from '@tloncorp/shared/logic';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import React, { PropsWithChildren, useMemo, useState } from 'react';

import type { McpProviderRow } from '../lib/mcpProviders';
import { ShipProvider } from '../contexts/ship';
import { ChatMessage, ScrollView, View } from '../ui';
import { McpConnectMenu } from '../ui/components/PostContent/McpConnectControl';
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

function makeApprovalA2UI({
  surfaceId,
  eyebrow,
  title,
  metadata,
  copy,
  allowNote,
  requestId,
  viewMessageTarget,
}: {
  surfaceId: string;
  eyebrow: string;
  title: string;
  metadata: string[];
  copy?: string;
  allowNote: string;
  requestId: string;
  viewMessageTarget?: A2UI.NavigationTarget;
}): A2UI.BlobEntry {
  const metadataChildren = metadata.map((_, index) => `metadata-${index}`);
  const actionChildren = ['allow', 'reject', 'ban'];
  const sourceActionComponents: A2UI.Component[] = viewMessageTarget
    ? [{ id: 'sourceAction', component: 'Row', children: ['viewMessage'] }]
    : [];
  const bodyChildren = copy
    ? [
        'eyebrow',
        'title',
        'titleDivider',
        ...metadataChildren,
        'copy',
        ...(viewMessageTarget ? ['sourceAction'] : []),
        'divider',
        'details',
        'actions',
      ]
    : [
        'eyebrow',
        'title',
        'titleDivider',
        ...metadataChildren,
        ...(viewMessageTarget ? ['sourceAction'] : []),
        'divider',
        'details',
        'actions',
      ];

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
            { id: 'root', component: 'Card', child: 'body' },
            {
              id: 'body',
              component: 'Column',
              children: bodyChildren,
            },
            {
              id: 'eyebrow',
              component: 'Text',
              variant: 'caption',
              text: eyebrow,
            },
            {
              id: 'title',
              component: 'Text',
              variant: 'h3',
              text: title,
            },
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
            ...(copy
              ? [
                  {
                    id: 'copy',
                    component: 'Text',
                    variant: 'caption',
                    text: copy,
                  } as const,
                ]
              : []),
            ...sourceActionComponents,
            { id: 'divider', component: 'Divider' },
            {
              id: 'details',
              component: 'Column',
              children: ['allowNote'],
            },
            {
              id: 'allowNote',
              component: 'Text',
              variant: 'caption',
              text: allowNote,
            },
            {
              id: 'actions',
              component: 'Row',
              children: actionChildren,
            },
            ...(viewMessageTarget
              ? [
                  {
                    id: 'viewMessage',
                    component: 'Button',
                    variant: 'secondary',
                    child: 'viewMessageLabel',
                    action: {
                      event: {
                        name: 'tlon.navigate',
                        context: { target: viewMessageTarget },
                      },
                    },
                  } as const,
                  {
                    id: 'viewMessageLabel',
                    component: 'Text',
                    text: 'View message',
                  } as const,
                ]
              : []),
            {
              id: 'allow',
              component: 'Button',
              variant: 'primary',
              child: 'allowLabel',
              action: {
                event: {
                  name: 'tlon.sendMessage',
                  context: { text: `/allow ${requestId}` },
                },
              },
            },
            { id: 'allowLabel', component: 'Text', text: 'Allow' },
            {
              id: 'reject',
              component: 'Button',
              child: 'rejectLabel',
              action: {
                event: {
                  name: 'tlon.sendMessage',
                  context: { text: `/reject ${requestId}` },
                },
              },
            },
            { id: 'rejectLabel', component: 'Text', text: 'Reject' },
            {
              id: 'ban',
              component: 'Button',
              variant: 'borderless',
              child: 'banLabel',
              action: {
                event: {
                  name: 'tlon.sendMessage',
                  context: { text: `/ban ${requestId}` },
                },
              },
            },
            { id: 'banLabel', component: 'Text', text: 'Block' },
          ],
        },
      },
    ],
  };
}

const confirmationA2UI = makeApprovalA2UI({
  surfaceId: 'confirm-dm-sampel',
  eyebrow: 'DM access',
  title: 'Allow Sam Palnet to DM the bot?',
  metadata: ['Sender: Sam Palnet (~sampel-palnet)'],
  copy: 'Message: "Hello, I would like to chat with your bot..."',
  allowNote:
    'The bot will be able to read and reply to future DMs from this user.',
  requestId: 'da1b2',
  viewMessageTarget: {
    type: 'message',
    channelId: dmChannelId,
    postId: '170.141.184.507',
    authorId: '~sampel-palnet',
  },
});

const channelApprovalA2UI = makeApprovalA2UI({
  surfaceId: 'confirm-channel-littel',
  eyebrow: 'Channel access',
  title: 'Let the bot reply to Littel Wolfur in Design?',
  metadata: [
    'Sender: Littel Wolfur (~littel-wolfur)',
    'Channel: Design',
    'Group: Garden Club',
  ],
  copy: 'Message: "@bearclawd can you review this build before I merge?"',
  allowNote:
    'The bot will be able to read and reply to this user in this channel.',
  requestId: 'c3d4e',
  viewMessageTarget: {
    type: 'message',
    channelId: 'chat/~zod/design',
    postId: '170.141.184.621',
    authorId: '~littel-wolfur',
    groupId: '~zod/garden-club',
  },
});

const groupApprovalA2UI = makeApprovalA2UI({
  surfaceId: 'confirm-group-robin',
  eyebrow: 'Group invite',
  title: 'Let the bot join Garden Club?',
  metadata: ['Inviter: Robin Dasler (~robin-dasler)', 'Group: Garden Club'],
  allowNote: 'The bot will be able to read and respond in channels it joins.',
  requestId: 'g5f6a',
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
            children: ['borderlessButton', 'navigateButton', 'disabledButton'],
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
            id: 'navigateButton',
            component: 'Button',
            variant: 'secondary',
            child: 'navigateLabel',
            action: {
              event: {
                name: 'tlon.navigate',
                context: {
                  target: {
                    type: 'profile',
                    userId: '~sampel-palnet',
                  },
                },
              },
            },
          },
          { id: 'navigateLabel', component: 'Text', text: 'Navigate' },
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

function makeControlA2UI(
  surfaceId: string,
  components: A2UI.Component[]
): A2UI.BlobEntry {
  return {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId, catalogId: 'tlon.a2ui.basic.v1' },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId, root: 'root', components },
      },
    ],
  };
}

const sendMessage = (text: string) => ({
  event: { name: 'tlon.sendMessage' as const, context: { text } },
});

const smallChoiceA2UI = makeControlA2UI('fixture-small-choice', [
  {
    id: 'root',
    component: 'SmallChoice',
    options: [
      { id: 'products', label: 'New products' },
      { id: 'patterns', label: 'Design patterns' },
      { id: 'papers', label: 'Research papers' },
    ],
    submitLabel: 'Continue',
    freeTextPlaceholder: 'Something else…',
    action: sendMessage('I want to follow:'),
  },
]);

const singleChoiceA2UI = makeControlA2UI('fixture-single-choice', [
  {
    id: 'root',
    component: 'SmallChoice',
    selectionMode: 'single',
    options: [
      { id: 'morning', label: 'Every morning' },
      { id: 'evening', label: 'Every evening' },
      { id: 'weekly', label: 'Once a week' },
    ],
    submitLabel: 'Continue',
    action: sendMessage('Send it:'),
  },
]);

const choiceA2UI = makeControlA2UI('fixture-choice', [
  {
    id: 'root',
    component: 'Choice',
    options: [
      {
        id: 'digest',
        label: 'A daily digest',
        description: 'A short summary, every morning.',
        icon: 'ChannelNotebooks',
        accent: 'blue',
        action: sendMessage('A daily digest'),
      },
      {
        id: 'watch',
        label: 'Watch for changes',
        description: 'Tell me when something I follow changes.',
        icon: 'Search',
        accent: 'green',
        action: sendMessage('Watch for changes'),
      },
      {
        id: 'chat',
        label: 'Just chat',
        description: 'Ask me anything, any time.',
        icon: 'ChannelTalk',
        accent: 'indigo',
        action: sendMessage('Just chat'),
      },
      {
        id: 'reminders',
        label: 'Reminders',
        description: 'Nudge me at the right time.',
        icon: 'Clock',
        accent: 'neutral',
        action: sendMessage('Reminders'),
      },
    ],
  },
]);

const compactChoiceA2UI = makeControlA2UI('fixture-compact-choice', [
  {
    id: 'root',
    component: 'Choice',
    options: [
      { id: 'yes', label: 'Yes, set it up', action: sendMessage('Yes') },
      { id: 'later', label: 'Remind me later', action: sendMessage('Later') },
      { id: 'no', label: 'No thanks', action: sendMessage('No') },
    ],
  },
]);

// Chat messages read the current user, which a logged-out native app does
// not have, so the fixtures sign in as a fixture ship.
function A2UIFixtureFrame({ children }: PropsWithChildren) {
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
      <FixtureWrapper fillWidth fillHeight>
        {children}
      </FixtureWrapper>
    </ShipProvider>
  );
}

const servicesComponent: A2UI.McpConnect = {
  id: 'services',
  component: 'McpConnect',
  maxVisible: 7,
  seeAllLabel: 'See all services',
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
        groupId: '~zod/fixture-workspace',
        provisionId: 'fixture-provision',
        providerIds: [],
      },
    },
  },
  completionLabel: 'Continue',
  completionAction: sendMessage('Continue'),
};

const serviceLogo = (id: string) =>
  `https://storage.googleapis.com/tlon-prod-memex-assets/oauth/${id}.png`;

const serviceProviders: McpProviderRow[] = [
  ['google-calendar', 'Google Calendar', 'connected'],
  ['notion', 'Notion', 'connected'],
  ['github', 'GitHub', 'connected'],
  ['google-gmail', 'Send Gmail', 'not-connected'],
  ['agentmail', 'AgentMail', 'not-connected'],
  ['airtable', 'Airtable', 'not-connected'],
  ['amplitude', 'Amplitude', 'not-connected'],
  ['linear', 'Linear', 'not-connected'],
].map(([id, displayName, status]) => ({
  id,
  displayName,
  logoUrl: serviceLogo(id),
  status: status as McpProviderRow['status'],
}));

function ServicesFixture() {
  return (
    <A2UIFixtureFrame>
      <ScrollView
        flex={1}
        contentContainerStyle={{
          alignItems: 'flex-start',
          paddingHorizontal: '$m',
          paddingVertical: '$2xl',
        }}
      >
        <View maxWidth={340} width="100%">
          <McpConnectMenu
            component={servicesComponent}
            surfaceId="fixture-services"
            configuredProviderIds={['google-calendar', 'notion', 'github']}
            providers={serviceProviders}
            onConfigure={async () => {}}
            onComplete={async () => {}}
            onNavigate={async () => {}}
          />
        </View>
      </ScrollView>
    </A2UIFixtureFrame>
  );
}

const smallChoicePost = makePost(
  exampleContacts.mark,
  [verse.inline('Which part of AI agent tooling should I follow?')],
  {
    blob: appendToPostBlob(undefined, smallChoiceA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const singleChoicePost = makePost(
  exampleContacts.mark,
  [verse.inline('When should I send your digest?')],
  {
    blob: appendToPostBlob(undefined, singleChoiceA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const choicePost = makePost(
  exampleContacts.mark,
  [verse.inline('What should I help with first?')],
  {
    blob: appendToPostBlob(undefined, choiceA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const compactChoicePost = makePost(
  exampleContacts.mark,
  [verse.inline('Want me to set up a weekly summary?')],
  {
    blob: appendToPostBlob(undefined, compactChoiceA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const weatherPost = makePost(
  exampleContacts.mark,
  [verse.inline('Weather: 22903 is 57F and partly cloudy.')],
  {
    blob: appendToPostBlob(undefined, weatherA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const confirmationPost = makePost(
  exampleContacts.groupAdmin,
  [verse.inline('DM request from Sam Palnet (~sampel-palnet)')],
  {
    blob: appendToPostBlob(undefined, confirmationA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const channelApprovalPost = makePost(
  exampleContacts.mark,
  [verse.inline('Channel mention request from Littel Wolfur (~littel-wolfur)')],
  {
    blob: appendToPostBlob(undefined, channelApprovalA2UI),
    channelId: dmChannelId,
    replyCount: 0,
  }
);

const groupApprovalPost = makePost(
  exampleContacts.groupAdmin,
  [verse.inline('Group invite request from Robin Dasler (~robin-dasler)')],
  {
    blob: appendToPostBlob(undefined, groupApprovalA2UI),
    channelId: dmChannelId,
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

const examplePosts = [
  weatherPost,
  confirmationPost,
  channelApprovalPost,
  groupApprovalPost,
  smallChoicePost,
  singleChoicePost,
  choicePost,
  compactChoicePost,
  basicComponentsPost,
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
    <A2UIFixtureFrame>
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
    </A2UIFixtureFrame>
  );
}

function A2UIExamplesFixture() {
  return (
    <A2UIFixtureFrame>
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
    </A2UIFixtureFrame>
  );
}

export default {
  BasicComponents: () => <A2UIFixture post={basicComponentsPost} />,
  Weather: () => <A2UIFixture post={weatherPost} />,
  ConfirmationDialog: () => <A2UIFixture post={confirmationPost} />,
  SmallChoice: () => <A2UIFixture post={smallChoicePost} />,
  SingleChoice: () => <A2UIFixture post={singleChoicePost} />,
  Choice: () => <A2UIFixture post={choicePost} />,
  CompactChoice: () => <A2UIFixture post={compactChoicePost} />,
  Services: () => <ServicesFixture />,
  Examples: () => <A2UIExamplesFixture />,
};
