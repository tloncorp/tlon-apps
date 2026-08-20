import * as db from '@tloncorp/shared/db';
import { setContactsMatchedHandler } from '@tloncorp/shared/store';
import React, { useEffect, useMemo } from 'react';
import { useValue } from 'react-cosmos/client';

import { AudiencePane } from '../ui/components/Wayfinding/AudiencePane';
import { PurposePane } from '../ui/components/Wayfinding/PurposePane';
import { SplashModal } from '../ui/components/Wayfinding/SplashModal';
import {
  InviteContactsContent,
  InvitePane,
  SplashSequence,
} from '../ui/components/Wayfinding/SplashSequence';
import { defaultStarterOptionId } from '../ui/components/Wayfinding/starterOptions';
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

  return (
    <FixtureWrapper fillWidth fillHeight>
      <SplashSequence onCompleted={handleCompleted} />
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

function PurposePaneFixture() {
  const [startUnselected] = useValue('Start With Nothing Selected', {
    defaultValue: false,
  });
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    defaultStarterOptionId
  );

  useEffect(() => {
    setSelectedId(startUnselected ? undefined : defaultStarterOptionId());
  }, [startUnselected]);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <PurposePane
        selectedId={selectedId}
        onSelect={setSelectedId}
        onActionPress={() => console.log('Purpose pane advanced:', selectedId)}
        onSkipPress={() => console.log('Purpose pane skipped')}
      />
    </FixtureWrapper>
  );
}

// The pure pane, not the wired container: cosmos has no ship, so the container
// would render its 'unavailable' branch forever. Driving inviteState by hand is
// what makes the three states inspectable.
function AudiencePaneFixture() {
  const [inviteState] = useValue<'ready' | 'loading' | 'unavailable'>(
    'Invite State',
    { defaultValue: 'ready' }
  );
  const [showFindPeople] = useValue('Offer The Address Book', {
    defaultValue: true,
  });
  const [isCompleting] = useValue('Completing', { defaultValue: false });

  return (
    <FixtureWrapper fillWidth fillHeight>
      <AudiencePane
        inviteState={inviteState}
        onInvitePress={() => console.log('Audience pane: invite')}
        onContinueAlone={() => console.log('Audience pane: continue alone')}
        onFindPeoplePress={
          showFindPeople
            ? () => console.log('Audience pane: find people')
            : undefined
        }
        isCompleting={isCompleting}
      />
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

  const syncSystemContacts = useMemo(
    () => async () => initialSystemContacts,
    []
  );

  const syncContactDiscovery = useMemo(() => {
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

    return async () => {
      await new Promise((r) => setTimeout(r, latencyMs));
      if (discoveryFails) {
        throw new Error('fixture: discovery failed');
      }
      return { didDiscover: true, newMatches };
    };
  }, [matchCount, latencyMs, discoveryFails]);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <InvitePane
        onActionPress={handleAction}
        syncSystemContacts={syncSystemContacts}
        syncContactDiscovery={syncContactDiscovery}
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
  'Purpose Pane': <PurposePaneFixture />,
  'Audience Pane': <AudiencePaneFixture />,
  'Invite Pane': <InvitePaneFixture />,
  'Splash Modal': <SplashModalFixture />,
};
