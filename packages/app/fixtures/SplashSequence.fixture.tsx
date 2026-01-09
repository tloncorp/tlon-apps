import React from 'react';

import {
  InviteContactsContent,
  SplashSequence,
} from '../ui/components/Wayfinding/SplashSequence';
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
  const handleComplete = React.useCallback(() => {
    console.log('Invite contacts completed');
  }, []);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InviteContactsContent
        onComplete={handleComplete}
        systemContacts={initialSystemContacts}
      />
    </FixtureWrapper>
  );
}

export default {
  'Welcome Sequence': <SplashSequenceFixture />,
  'Invite Contacts': <InviteContactsFixture />,
};
