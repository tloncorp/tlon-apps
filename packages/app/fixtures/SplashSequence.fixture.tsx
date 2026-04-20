import * as db from '@tloncorp/shared/db';
import { PersonalityType } from '@tloncorp/shared/domain';
import React, { useEffect } from 'react';
import { useValue } from 'react-cosmos/client';

import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import {
  BotLaunchLoadingPane,
  BotLaunchPane,
  BotModelPane,
  BotNamePane,
  BotPersonalityPane,
  ChannelsPane,
  GroupsPane,
  InviteContactsContent,
  InvitePane,
  PrivacyPane,
  ShareGroupPane,
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

  return (
    <FixtureWrapper fillWidth fillHeight>
      <GroupsPane onActionPress={handleAction} hostingBotEnabled />
    </FixtureWrapper>
  );
}

function ChannelsPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Channels pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <ChannelsPane onActionPress={handleAction} />
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
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const handleAction = React.useCallback(() => {
    console.log('BotName pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotNamePane
        name={name}
        avatarUrl={avatarUrl}
        botMoonId={null}
        botContactAvatarUrl={null}
        onNameChange={setName}
        onAvatarUrlChange={setAvatarUrl}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotPersonalityPaneFixture() {
  const [personality, setPersonality] = useValue<PersonalityType>(
    'Personality',
    {
      defaultValue: 'assistant',
    }
  );
  const handleAction = React.useCallback(() => {
    console.log('BotPersonality pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotPersonalityPane
        personality={personality}
        onPersonalityChange={setPersonality}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotModelPaneFixture() {
  const [model, setModel] = useValue('Model', { defaultValue: 'minimax' });
  const [apiKey, setApiKey] = useValue('API Key', { defaultValue: '' });
  const handleAction = React.useCallback(() => {
    console.log('BotModel pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotModelPane
        model={model}
        apiKey={apiKey}
        onModelChange={setModel}
        onApiKeyChange={setApiKey}
        onActionPress={handleAction}
      />
    </FixtureWrapper>
  );
}

function BotLaunchPaneFixture() {
  const [showError] = useValue('Show Error', { defaultValue: false });
  const handleCreateGroup = React.useCallback(() => {
    console.log('Create group pressed');
  }, []);
  const handleSkip = React.useCallback(() => {
    console.log('Skip pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotLaunchPane
        botName="Tlonbot"
        botAvatarUrl={null}
        botMoonId={null}
        botContactAvatarUrl={null}
        onCreateGroup={handleCreateGroup}
        onSkip={handleSkip}
        error={showError ? 'Something went wrong. Try again or skip.' : null}
      />
    </FixtureWrapper>
  );
}

function BotLaunchLoadingPaneFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <BotLaunchLoadingPane botAvatarUrl={null} botMoonId={null} botContactAvatarUrl={null} />
    </FixtureWrapper>
  );
}

function ShareGroupPaneFixture() {
  const [hasInviteLink] = useValue('Has Invite Link', { defaultValue: true });
  const handleAction = React.useCallback(() => {
    console.log('ShareGroup pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <ShareGroupPane
        botName="Tlonbot"
        botAvatarUrl={null}
        botMoonId={null}
        botContactAvatarUrl={null}
        inviteLink={
          hasInviteLink ? 'https://join.tlon.io/example-invite-link' : null
        }
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

export default {
  'Full Sequence': <SplashSequenceFixture />,
  'Invite Contacts': <InviteContactsFixture />,
  'Welcome Pane': <WelcomePaneFixture />,
  'Groups Pane': <GroupsPaneFixture />,
  'Channels Pane': <ChannelsPaneFixture />,
  'Privacy Pane': <PrivacyPaneFixture />,
  'TlonBot Pane': <TlonBotPaneFixture />,
  'Bot Name Pane': <BotNamePaneFixture />,
  'Bot Personality Pane': <BotPersonalityPaneFixture />,
  'Bot Model Pane': <BotModelPaneFixture />,
  'Bot Launch Pane': <BotLaunchPaneFixture />,
  'Bot Launch Loading Pane': <BotLaunchLoadingPaneFixture />,
  'Share Group Pane': <ShareGroupPaneFixture />,
  'Invite Pane': <InvitePaneFixture />,
  'Splash Modal': <SplashModalFixture />,
};
