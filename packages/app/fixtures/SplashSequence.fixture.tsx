import React from 'react';

import {
  SplashSequence,
  WelcomePane,
  GroupsPane,
  ChannelsPane,
  PrivacyPane,
  InvitePane,
} from '../ui/components/Wayfinding/SplashSequence';
import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import { FixtureWrapper } from './FixtureWrapper';

function SplashSequenceFixture() {
  const handleCompleted = React.useCallback(() => {
    console.log('Splash sequence completed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <SplashSequence onCompleted={handleCompleted} />
    </FixtureWrapper>
  );
}

function WelcomePaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Welcome pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <WelcomePane onActionPress={handleAction} />
    </FixtureWrapper>
  );
}

function GroupsPaneFixture() {
  const handleAction = React.useCallback(() => {
    console.log('Groups pane action pressed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <GroupsPane onActionPress={handleAction} />
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
  'Welcome Pane': <WelcomePaneFixture />,
  'Groups Pane': <GroupsPaneFixture />,
  'Channels Pane': <ChannelsPaneFixture />,
  'Privacy Pane': <PrivacyPaneFixture />,
  'Invite Pane': <InvitePaneFixture />,
  'Splash Modal': <SplashModalFixture />,
}; 