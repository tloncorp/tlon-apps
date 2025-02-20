import { faker } from '@faker-js/faker';
import * as db from '@tloncorp/shared/db';
import { useFixtureInput } from 'react-cosmos/client';

import { AppDataContextProvider, UserProfileScreenView } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

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
};

function ProfileScreenFixture({ contactId }: { contactId: string }) {
  const [isCurrentUser] = useFixtureInput('isCurrentUser', false);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider
        currentUserId={isCurrentUser ? contactId : '~zod'}
        contacts={Object.values(exampleContacts)}
      >
        <UserProfileScreenView
          userId={contactId}
          onBack={() => {}}
          connectionStatus={{ complete: true, status: 'yes' }}
          onPressEdit={() => {}}
          onPressGroup={() => {
            console.log('group pressed');
          }}
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
};
