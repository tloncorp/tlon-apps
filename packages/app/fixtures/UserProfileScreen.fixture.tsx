import { faker } from '@faker-js/faker';
import * as api from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import { useState } from 'react';
import { useFixtureInput } from 'react-cosmos/client';

import { AppDataContextProvider, UserProfileScreenView } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, hostedBotContact } from './fakeData';

const exampleContacts: Record<string, db.Contact> = {
  base: {
    id: '~solfer-magfed',
    nickname: 'Dan b',
    color: faker.color.rgb(),
    bio: faker.lorem.paragraphs(2),
    avatarImage: faker.image.avatar(),
    coverImage: faker.image.urlLoremFlickr(),
    pinnedGroups: [
      {
        contactId: '~fabled-faster',
        groupId: group.id,
        group,
      },
    ],
  },
  noBio: {
    id: '~fabled-faster',
    nickname: 'É. Urcades',
    color: faker.color.rgb(),
    avatarImage: faker.image.avatar(),
    coverImage: faker.image.urlLoremFlickr(),
    pinnedGroups: [
      {
        contactId: '~fabled-faster',
        groupId: group.id,
        group,
      },
    ],
  },
  empty: {
    id: '~latter-bolden',
  },
  botOwner: {
    id: '~sampel-palnet',
    nickname: 'bill',
    color: faker.color.rgb(),
    status: 'testing onboarding',
    bio: 'tlon corp',
    avatarImage: faker.image.avatar(),
  },
  ownedBot: {
    ...hostedBotContact,
    nickname: 'Tlonbot',
    avatarImage: faker.image.avatar(),
    botInfo: JSON.stringify({ v: 1, harness: 'openclaw', version: '0.19.0' }),
    botLiveness: JSON.stringify({ v: 1, state: 'online' }),
  },
  // Its owner, ~finned-palmer, has no contact record.
  botWithUnknownOwner: {
    id: '~pinser-botter-finned-palmer',
  },
};

const noop = () => {};

function ProfileScreenFixture({
  contactId,
  viewerId,
}: {
  contactId: string;
  /** Who is looking, when not ~zod: the owner, for their own bot. */
  viewerId?: string;
}) {
  const [isCurrentUser] = useFixtureInput('isCurrentUser', false);
  const [userId, setUserId] = useState(contactId);
  const ownsBot = !!viewerId && api.getBotOwnerId(userId) === viewerId;

  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider
        currentUserId={isCurrentUser ? contactId : (viewerId ?? '~zod')}
        contacts={Object.values(exampleContacts)}
      >
        <UserProfileScreenView
          userId={userId}
          connectionStatus={{ complete: true, status: 'yes' }}
          onPressGroup={() => {
            console.log('group pressed');
          }}
          onPressUserProfile={setUserId}
          onPressBotSettings={ownsBot ? noop : undefined}
          onPressScheduledTasks={ownsBot ? noop : undefined}
          scheduledTaskCount={ownsBot ? 3 : undefined}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  );
}

export default {
  'Full Profile': <ProfileScreenFixture contactId={exampleContacts.base.id} />,
  'Profile without bio': (
    <ProfileScreenFixture contactId={exampleContacts.noBio.id} />
  ),
  'Empty profile': (
    <ProfileScreenFixture contactId={exampleContacts.empty.id} />
  ),
  'Profile with Tlonbot': (
    <ProfileScreenFixture contactId={exampleContacts.botOwner.id} />
  ),
  'Bot profile': (
    <ProfileScreenFixture contactId={exampleContacts.ownedBot.id} />
  ),
  'Your bot profile': (
    <ProfileScreenFixture
      contactId={exampleContacts.ownedBot.id}
      viewerId={exampleContacts.botOwner.id}
    />
  ),
  'Bot profile, owner not met': (
    <ProfileScreenFixture contactId={exampleContacts.botWithUnknownOwner.id} />
  ),
};
