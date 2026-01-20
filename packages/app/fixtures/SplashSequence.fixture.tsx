import * as db from '@tloncorp/shared/db';
import React, { useEffect } from 'react';
import { useValue } from 'react-cosmos/client';

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

export default {
  'Welcome Sequence': <SplashSequenceFixture />,
  'Invite Contacts': <InviteContactsFixture />,
};
