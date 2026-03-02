import * as db from '@tloncorp/shared/db';
import React, { useEffect } from 'react';
import { useValue } from 'react-cosmos/client';

import {
  SplashSequence,
  WelcomePane,
  GroupsPane,
  ChannelsPane,
  PrivacyPane,
  TlonBotPane,
  InvitePane,
  InviteContactsContent,
} from '../ui/components/Wayfinding/SplashSequence';
import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import { FixtureWrapper } from './FixtureWrapper';
import { initialSystemContacts } from './fakeData';

function SplashSequenceFixture() {
  const handleCompleted = React.useCallback(() => {
    console.log('Splash sequence completed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <SplashSequence
        onCompleted={handleCompleted}
        systemContacts={initialSystemContacts}
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
      db.personalInviteLink.setValue('https://join.tlon.io/example-invite-link');
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

const mockDeviceSize = {
  isTiny: false,
  isSmall: false,
  height: 800,
};

function WelcomePaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Welcome pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <WelcomePane onActionPress={handleAction} deviceSize={mockDeviceSize} />
    </FixtureWrapper>
  );
}

function GroupsPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Groups pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <GroupsPane onActionPress={handleAction} deviceSize={mockDeviceSize} />
    </FixtureWrapper>
  );
}

function ChannelsPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Channels pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <ChannelsPane onActionPress={handleAction} deviceSize={mockDeviceSize} />
    </FixtureWrapper>
  );
}

function PrivacyPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Privacy pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <PrivacyPane onActionPress={handleAction} deviceSize={mockDeviceSize} />
    </FixtureWrapper>
  );
}

function InvitePaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Invite pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InvitePane onActionPress={handleAction} deviceSize={mockDeviceSize} />
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
  'Invite Pane': <InvitePaneFixture />,
  'Splash Modal': <SplashModalFixture />,
};
