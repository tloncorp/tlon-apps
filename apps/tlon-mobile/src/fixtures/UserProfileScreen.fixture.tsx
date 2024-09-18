import { faker } from '@faker-js/faker';
import * as db from '@tloncorp/shared/dist/db';
import {
  AppDataContextProvider,
  UserProfileScreenView,
} from '@tloncorp/ui/src';

import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const exampleContacts: Record<string, db.Contact> = {
  zod: {
    id: '~fabled-faster',
    nickname: 'É. Urcades',
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
};

function ProfileScreenFixture() {
  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider
        currentUserId="~zod"
        contacts={Object.values(exampleContacts)}
      >
        <UserProfileScreenView
          userId="~fabled-faster"
          onBack={() => {}}
          connectionStatus={{ complete: true, status: 'yes' }}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  );
}

export default <ProfileScreenFixture />;
