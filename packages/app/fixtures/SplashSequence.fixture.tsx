import * as db from '@tloncorp/shared/db';
import React, { useEffect } from 'react';
import { useValue } from 'react-cosmos/client';

import { BotChatPreview } from '../ui/components/Wayfinding/BotChatPreview';
import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import {
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

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InviteContactsContent
        onComplete={handleComplete}
        systemContacts={contacts}
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
  const handleAction = React.useCallback(() => {
    console.log('Invite pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InvitePane onActionPress={handleAction} />
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

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotAvatarPane
        avatarUrl={avatarUrl}
        onAvatarUrlChange={setAvatarUrl}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}


function BotProviderPaneFixture() {
  const [model, setModel] = useValue('Provider', { defaultValue: 'basic' });
  const [apiKey, setApiKey] = useValue('API Key', { defaultValue: '' });
  const handleAction = React.useCallback(() => {
    console.log('BotProvider pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotProviderPane
        model={model}
        apiKey={apiKey}
        providers={[
          { label: 'MiniMax', provider: 'basic', requiresKey: false },
          { label: 'Anthropic', provider: 'anthropic', requiresKey: true },
          { label: 'OpenAI', provider: 'openai', requiresKey: true },
          { label: 'OpenRouter', provider: 'openrouter', requiresKey: true },
        ]}
        onModelChange={setModel}
        onApiKeyChange={setApiKey}
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

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotModelPane
        models={[
          { id: 'anthropic/claude-3-5-sonnet' },
          { id: 'anthropic/claude-3-opus' },
          { id: 'anthropic/claude-3-haiku' },
        ]}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
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
  'Bot Model Pane': <BotModelPaneFixture />,
  'Bot Chat Preview': <BotChatPreviewFixture />,
  'Invite Pane': <InvitePaneFixture />,
  'Splash Modal': <SplashModalFixture />,
};
