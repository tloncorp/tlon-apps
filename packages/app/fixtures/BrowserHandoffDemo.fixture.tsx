// tamagui-ignore
import type { JSONValue } from '@tloncorp/shared';
import { appendToPostBlob } from '@tloncorp/shared/logic';
import { useEffect, useMemo, useState } from 'react';
import { isWeb } from 'tamagui';

import { ShipProvider } from '../contexts/ship';
import { BrowserCredentialHandoffProvider } from '../features/browser/BrowserCredentialHandoffProvider';
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

export const browserHandoffDemoUrl =
  process.env.EXPO_PUBLIC_BROWSER_VIEWER_DEMO_URL ??
  'https://browser-session.tlon.network/s/fixture.signature';
const entry = {
  type: 'browser-secure-entry',
  version: 1,
  viewerUrl: browserHandoffDemoUrl,
  presentation: { purpose: 'login', site: 'wikipedia.org' },
} as const;
const credentialEntry = entry;

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
const sessionPost = makePost(contact, [], {
  id: 'local-browser-session-post',
  channelId: channel.id,
  groupId: null,
  replyCount: 0,
  blob: appendToPostBlob(undefined, {
    type: 'browser-session',
    version: 1,
    viewerUrl: browserHandoffDemoUrl,
  }),
});
function DemoConversation({
  credentialOnly,
  submitted,
}: {
  credentialOnly: boolean;
  submitted: boolean;
}) {
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
            {!credentialOnly ? (
              <ChatMessage post={sessionPost} showAuthor showReplies={false} />
            ) : null}
            <ChatMessage
              post={
                credentialOnly
                  ? {
                      ...post,
                      blob: appendToPostBlob(undefined, credentialEntry),
                      content: JSON.stringify([
                        verse.inline(
                          'Please enter your Wikipedia login using the secure form below.'
                        ),
                      ]),
                    }
                  : post
              }
              showAuthor
              showReplies={false}
            />
            {submitted ? (
              <Text padding="$l">
                Demo submitted. Nothing was sent to Wikipedia. Reopen the card
                to try again.
              </Text>
            ) : null}
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

export default function BrowserHandoffDemo({
  credentialOnly = false,
  submitted = false,
}: {
  credentialOnly?: boolean;
  submitted?: boolean;
}) {
  const [identityReady, setIdentityReady] = useState(!isWeb);
  useEffect(() => {
    if (!isWeb) return;
    // Web reads the current ship from window; native reads ShipProvider.
    const previousUser = window.our;
    window.our = '~sampel-palnet';
    setIdentityReady(true);
    return () => {
      window.our = previousUser;
    };
  }, []);
  if (!identityReady) return null;
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
          <DemoConversation
            credentialOnly={credentialOnly}
            submitted={submitted}
          />
        </BrowserCredentialHandoffProvider>
      </FixtureWrapper>
    </ShipProvider>
  );
}
