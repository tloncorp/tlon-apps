import { spyOn } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { setContactsMatchedHandler } from '@tloncorp/shared/store';
import React, { useEffect, useMemo } from 'react';
import { useValue } from 'react-cosmos/client';

import { StoreProvider, createNoOpStore } from '../ui';
import { BotChatPreview } from '../ui/components/Wayfinding/BotChatPreview';
import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import {
  BotApiKeyPane,
  BotAvatarPane,
  BotModelPane,
  BotNamePane,
  BotProviderPane,
  ChannelsPane,
  GroupsPane,
  InviteContactsContent,
  InvitePane,
  PrivacyPane,
  SplashSequence,
  TlonBotPane,
  WelcomePane,
} from '../ui/components/Wayfinding/SplashSequence';
import { FixtureWrapper } from './FixtureWrapper';
import { initialSystemContacts } from './fakeData';

const FIXTURE_MOCK_SHIPS = [
  '~ravmel-ropdyl',
  '~palfun-foslup',
  '~bisbex-radmev',
  '~watter-parner',
  '~rilfun-lidlen',
];

function SplashSequenceFixture() {
  const handleCompleted = React.useCallback(() => {
    console.log('Splash sequence completed');
  }, []);

  const [hostingBotEnabled] = useValue('Enable Hosting Bot', {
    defaultValue: true,
  });

  return (
    <FixtureWrapper fillWidth fillHeight>
      <SplashSequence
        onCompleted={handleCompleted}
        hostingBotEnabled={hostingBotEnabled}
      />
    </FixtureWrapper>
  );
}

function InviteContactsFixture() {
  const [isLoading] = useValue('Show Loading State', { defaultValue: false });
  const [showEmptyState] = useValue('Show Empty State (Share Link)', {
    defaultValue: false,
  });
  const [isDiscovering] = useValue('Discovering Matches', {
    defaultValue: false,
  });
  const [matchCount] = useValue('Match Count', { defaultValue: 0 });

  const handleComplete = React.useCallback(() => {
    console.log('Invite contacts completed');
  }, []);

  useEffect(() => {
    if (isLoading) {
      db.personalInviteLink.setValue(null);
    } else {
      db.personalInviteLink.setValue(
        'https://join.tlon.io/example-invite-link'
      );
    }
  }, [isLoading]);

  const contacts = showEmptyState ? [] : initialSystemContacts;
  const clampedCount = Math.max(
    0,
    Math.min(matchCount, initialSystemContacts.length)
  );
  const discoveredMatches = showEmptyState
    ? []
    : initialSystemContacts.slice(0, clampedCount);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InviteContactsContent
        onComplete={handleComplete}
        systemContacts={contacts}
        isDiscovering={isDiscovering}
        discoveredMatches={discoveredMatches}
      />
    </FixtureWrapper>
  );
}

function WelcomePaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Welcome pane action pressed');
  }, []);

  const [hostingBotEnabled] = useValue('Enable Hosting Bot', {
    defaultValue: true,
  });

  return (
    <FixtureWrapper fillWidth fillHeight>
      <WelcomePane
        onActionPress={handleAction}
        hostingBotEnabled={hostingBotEnabled}
      />
    </FixtureWrapper>
  );
}

function GroupsPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Groups pane action pressed');
  }, []);
  const [withBot] = useValue('With Tlonbot', { defaultValue: true });

  return (
    <FixtureWrapper fillWidth fillHeight>
      <GroupsPane
        onActionPress={handleAction}
        hostingBotEnabled={withBot}
        botName="Tlonbot"
        didConfigureBot
        userShipId="~rilfun-lidlen"
        botShipId="~nocsyx-lassul-rilfun-lidlen"
      />
    </FixtureWrapper>
  );
}

function ChannelsPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Channels pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <ChannelsPane onActionPress={handleAction} hostingBotEnabled />
    </FixtureWrapper>
  );
}

function PrivacyPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Privacy pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <PrivacyPane onActionPress={handleAction} />
    </FixtureWrapper>
  );
}

function TlonBotPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('TlonBot pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <TlonBotPane onActionPress={handleAction} />
    </FixtureWrapper>
  );
}

function InvitePaneFixture() {
  const [matchCount] = useValue('Match Count', { defaultValue: 3 });
  const [latencyMs] = useValue('Discovery Latency (ms)', {
    defaultValue: 1500,
  });
  const [discoveryFails] = useValue('Discovery Fails', { defaultValue: false });

  // Register a logging match handler so the "advanced before discovery
  // resolved" tail path is observable in Cosmos. In the real mobile app
  // this is set by useNotificationListener to fire a local notification.
  useEffect(() => {
    setContactsMatchedHandler((ids) =>
      console.log('[fixture] would notify for contacts:', ids)
    );
    return () => setContactsMatchedHandler(null);
  }, []);

  const handleAction = React.useCallback(() => {
    console.log('Invite pane action pressed');
  }, []);

  const stubStore = useMemo(() => {
    const base = createNoOpStore();
    const phones = initialSystemContacts
      .map((c) => c.phoneNumber)
      .filter((p): p is string => !!p);
    const cap = Math.max(0, Math.min(matchCount, phones.length));
    const newMatches: [string, string][] = phones
      .slice(0, cap)
      .map((phone, i) => [
        phone,
        FIXTURE_MOCK_SHIPS[i % FIXTURE_MOCK_SHIPS.length],
      ]);

    return spyOn(
      // The store object isn't typed for these stubs cleanly; cast to keep
      // the fixture readable.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spyOn(
        base,
        'syncSystemContacts',
        (async () => initialSystemContacts) as any
      ),
      'syncContactDiscovery',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (async () => {
        await new Promise((r) => setTimeout(r, latencyMs));
        if (discoveryFails) {
          throw new Error('fixture: discovery failed');
        }
        return { newMatches };
      }) as any
    );
  }, [matchCount, latencyMs, discoveryFails]);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <StoreProvider stub={stubStore}>
        <InvitePane onActionPress={handleAction} />
      </StoreProvider>
    </FixtureWrapper>
  );
}

function BotNamePaneFixture() {
  const [name, setName] = useValue('Bot Name', { defaultValue: '' });
  const [userNickname] = useValue('User Nickname', { defaultValue: 'palbud' });
  const handleAction = React.useCallback(() => {
    console.log('BotName pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotNamePane
        name={name}
        userNickname={userNickname}
        onNameChange={setName}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotAvatarPaneFixture() {
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const handleAction = React.useCallback(() => {
    console.log('BotAvatar pane action pressed');
  }, []);
  const handleBack = React.useCallback(() => {
    console.log('BotAvatar pane back pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotAvatarPane
        avatarUrl={avatarUrl}
        onAvatarUrlChange={setAvatarUrl}
        onBackPress={handleBack}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotProviderPaneFixture() {
  const [model, setModel] = useValue('Provider', { defaultValue: 'basic' });
  const handleAction = React.useCallback(() => {
    console.log('BotProvider pane action pressed');
  }, []);
  const handleBack = React.useCallback(() => {
    console.log('BotProvider pane back pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotProviderPane
        model={model}
        providers={[
          { label: 'MiniMax', provider: 'basic', requiresKey: false },
          { label: 'Anthropic', provider: 'anthropic', requiresKey: true },
          { label: 'OpenAI', provider: 'openai', requiresKey: true },
          { label: 'OpenRouter', provider: 'openrouter', requiresKey: true },
        ]}
        onModelChange={setModel}
        onBackPress={handleBack}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotApiKeyPaneFixture() {
  const [apiKey, setApiKey] = useValue('API Key', { defaultValue: '' });
  const handleAction = React.useCallback(() => {
    console.log('BotApiKey pane action pressed');
  }, []);
  const handleBack = React.useCallback(() => {
    console.log('BotApiKey pane back pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotApiKeyPane
        providerLabel="OpenAI"
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        onBackPress={handleBack}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotModelPaneFixture() {
  const [selectedModel, setSelectedModel] = useValue('Model', {
    defaultValue: 'anthropic/claude-3-5-sonnet',
  });
  const handleAction = React.useCallback(() => {
    console.log('BotModel pane action pressed');
  }, []);
  const handleBack = React.useCallback(() => {
    console.log('BotModel pane back pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotModelPane
        models={[
          { id: 'anthropic/claude-3-5-sonnet' },
          { id: 'anthropic/claude-3-opus' },
          { id: 'anthropic/claude-3-haiku' },
          { id: 'anthropic/claude-3-7-sonnet' },
          { id: 'anthropic/claude-sonnet-4' },
          { id: 'anthropic/claude-opus-4' },
          { id: 'openai/gpt-4o' },
          { id: 'openai/gpt-4.1' },
          { id: 'openai/gpt-4.1-mini' },
          { id: 'openai/gpt-4.1-nano' },
          { id: 'openai/o3' },
          { id: 'openai/o4-mini' },
          { id: 'google/gemini-1.5-pro' },
          { id: 'google/gemini-1.5-flash' },
          { id: 'google/gemini-2.0-flash' },
          { id: 'meta/llama-3.1-8b-instruct' },
          { id: 'meta/llama-3.1-70b-instruct' },
          { id: 'mistral/mistral-large' },
          { id: 'mistral/mistral-small' },
          { id: 'minimax/minimax-text-01' },
          { id: 'openrouter/anthropic/claude-3.5-sonnet' },
          { id: 'openrouter/openai/gpt-4o-mini' },
        ]}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onBackPress={handleBack}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function SplashModalFixture() {
  const [open, setOpen] = React.useState(true);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <SplashModal open={open} setOpen={setOpen} />
    </FixtureWrapper>
  );
}

function BotChatPreviewFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotChatPreview
        userShipId="~rilfun-lidlen"
        botShipId="~nocsyx-lassul-rilfun-lidlen"
      />
    </FixtureWrapper>
  );
}

export default {
  'Full Sequence': <SplashSequenceFixture />,
  'Invite Contacts': <InviteContactsFixture />,
  'Welcome Pane': <WelcomePaneFixture />,
  'Groups Pane': <GroupsPaneFixture />,
  'Channels Pane': <ChannelsPaneFixture />,
  'Privacy Pane': <PrivacyPaneFixture />,
  'TlonBot Pane': <TlonBotPaneFixture />,
  'Bot Name Pane': <BotNamePaneFixture />,
  'Bot Avatar Pane': <BotAvatarPaneFixture />,
  'Bot Provider Pane': <BotProviderPaneFixture />,
  'Bot API Key Pane': <BotApiKeyPaneFixture />,
  'Bot Model Pane': <BotModelPaneFixture />,
  'Bot Chat Preview': <BotChatPreviewFixture />,
  'Invite Pane': <InvitePaneFixture />,
  'Splash Modal': <SplashModalFixture />,
};
