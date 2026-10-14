// tamagui-ignore
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { JSONValue } from '@tloncorp/shared';
import { appendToPostBlob, type A2UI } from '@tloncorp/shared/logic';
import { useMemo, useState } from 'react';

import { ShipProvider } from '../contexts/ship';
import { BrowserCredentialHandoffProvider } from '../features/browser/BrowserCredentialHandoffProvider';
import { BrowserCredentialHandoffScreen } from '../features/browser/BrowserCredentialHandoffScreen';
import { Text } from '@tloncorp/ui';
import { ChatMessage, ScrollView, YStack } from '../ui';
import {
  DraftInputContextProvider,
  type DraftInputContext,
} from '../ui/components/draftInputs/shared';
import { ChannelProvider } from '../ui/contexts/channel';
import { FixtureWrapper } from './FixtureWrapper';
import { makePost, verse } from './contentHelpers';
import { hostedBotContact, tlonLocalIntros, group } from './fakeData';

const viewerUrl =
  process.env.EXPO_PUBLIC_BROWSER_VIEWER_DEMO_URL ??
  'https://browser-session.tlon.network/s/fixture.signature';
const components = [
  { id: 'root', component: 'Card', child: 'body' },
  {
    id: 'body',
    component: 'Column',
    children: [
      'title',
      'title-divider',
      'explanation',
      'privacy-direct',
      'privacy-context',
      'action-divider',
      'actions',
    ],
  },
  {
    id: 'title',
    component: 'Text',
    variant: 'h3',
    text: 'Secure browser input',
  },
  { id: 'title-divider', component: 'Divider' },
  {
    id: 'explanation',
    component: 'Text',
    text: 'The browser needs information you can enter securely.',
  },
  {
    id: 'privacy-direct',
    component: 'Text',
    variant: 'caption',
    text: 'Your input goes directly to the live browser.',
  },
  {
    id: 'privacy-context',
    component: 'Text',
    variant: 'caption',
    text: 'It does not pass through chat or the bot.',
  },
  { id: 'action-divider', component: 'Divider' },
  {
    id: 'actions',
    component: 'Row',
    children: ['open-form', 'continue'],
    align: 'center',
  },
  {
    id: 'open-form',
    component: 'Button',
    weight: 1,
    variant: 'primary',
    child: 'open-form-label',
    action: {
      event: {
        name: 'tlon.navigate',
        context: {
          target: {
            type: 'screen',
            screen: 'browserCredentialHandoff',
            viewerUrl,
          },
        },
      },
    },
  },
  {
    id: 'open-form-label',
    component: 'Text',
    text: 'Open secure form',
  },
  {
    id: 'continue',
    component: 'Button',
    weight: 1,
    variant: 'secondary',
    child: 'continue-label',
    action: {
      event: {
        name: 'tlon.sendMessage',
        context: {
          text: 'Continue the browser task. Check the current page; this does not confirm sign-in or authorize a purchase.',
        },
      },
    },
  },
  {
    id: 'continue-label',
    component: 'Text',
    text: 'Continue task',
  },
];

const surfaceId = 'local-browser-handoff';
const entry: A2UI.BlobEntry = {
  type: 'a2ui',
  version: 1,
  storyMode: 'fallback',
  messages: [
    {
      version: 'v0.9',
      createSurface: { surfaceId, catalogId: 'tlon.a2ui.basic.v2' },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        root: 'root',
        components: components as A2UI.Component[],
      },
    },
  ],
};
const contact = {
  ...hostedBotContact,
  nickname: 'Browser demo bot',
  avatarImage: null,
};
const channel = {
  ...tlonLocalIntros,
  id: contact.id,
  type: 'dm' as const,
  groupId: null,
};
const post = makePost(
  contact,
  [
    verse.inline(
      'I opened a browser for you. Use the card below to take over.'
    ),
  ],
  {
    id: 'local-browser-handoff-post',
    channelId: channel.id,
    groupId: null,
    replyCount: 0,
    blob: appendToPostBlob(undefined, entry),
  }
);
const sessionPost = makePost(
  contact,
  [
    {
      block: {
        link: {
          url: viewerUrl,
          meta: {
            siteName: 'Browser session',
            title: 'Open browser',
            description: 'View and control the shared browser.',
          },
        },
      },
    },
  ],
  {
    id: 'local-browser-session-post',
    channelId: channel.id,
    groupId: null,
    replyCount: 0,
  }
);
const Stack = createNativeStackNavigator<{
  DemoChat: undefined;
  BrowserCredentialHandoff: { handoffId: string };
}>();

function DemoConversation() {
  const [continued, setContinued] = useState(false);
  const [shouldBlur, setShouldBlur] = useState(false);
  const draftContext = useMemo<DraftInputContext>(
    () => ({
      canStartDraft: true,
      group,
      channel,
      clearDraft: async () => {},
      configuration: {} as Record<string, JSONValue>,
      getDraft: async () => null,
      sendPostFromDraft: async () => {
        setContinued(true);
      },
      setShouldBlur,
      shouldBlur,
      startDraft: () => {},
      storeDraft: async () => {},
    }),
    [shouldBlur]
  );
  return (
    <ChannelProvider value={{ channel }}>
      <DraftInputContextProvider value={draftContext}>
        <YStack flex={1} paddingTop="$2xl" backgroundColor="$background">
          <YStack padding="$l" borderBottomWidth={1} borderColor="$border">
            <Text size="$label/l" fontWeight="600">
              Browser demo bot
            </Text>
            <Text color="$secondaryText">Local test conversation</Text>
          </YStack>
          <ScrollView flex={1} contentContainerStyle={{ padding: 16 }}>
            <ChatMessage post={sessionPost} showAuthor showReplies={false} />
            <ChatMessage post={post} showAuthor showReplies={false} />
            {continued ? (
              <Text padding="$l">
                Task continued. This demo does not send a message to a live bot.
              </Text>
            ) : null}
          </ScrollView>
        </YStack>
      </DraftInputContextProvider>
    </ChannelProvider>
  );
}

export default function BrowserHandoffDemo() {
  return (
    <ShipProvider
      initialShipInfo={{
        authType: 'self',
        authCookie: undefined,
        ship: 'sampel-palnet',
        shipUrl: 'http://127.0.0.1',
      }}
    >
      <FixtureWrapper
        fillWidth
        fillHeight
        currentUserId="~sampel-palnet"
        safeArea
      >
        <BrowserCredentialHandoffProvider>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="DemoChat" component={DemoConversation} />
            <Stack.Screen
              name="BrowserCredentialHandoff"
              component={BrowserCredentialHandoffScreen}
            />
          </Stack.Navigator>
        </BrowserCredentialHandoffProvider>
      </FixtureWrapper>
    </ShipProvider>
  );
}
