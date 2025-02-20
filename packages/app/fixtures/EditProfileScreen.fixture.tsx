import { faker } from '@faker-js/faker';
import * as db from '@tloncorp/shared/db';
import {
  AppDataContextProvider,
  EditProfileScreenView,
} from '../ui/src';
import { useFixtureInput } from 'react-cosmos/client';

import { FixtureWrapper } from './FixtureWrapper';
import { group } from './fakeData';

const exampleContacts: Record<string, db.Contact> = {
  base: {
    id: '~solfer-magfed',
    nickname: 'Dan b',
    color: faker.color.rgb(),
    bio: faker.lorem.paragraphs(2),
    avatarImage: faker.image.avatar(),
    pinnedGroups: [
      {
        contactId: '~fabled-faster',
        groupId: group.id,
        group,
      },
    ],
  },
};

function EditProfileScreen({ contactId }: { contactId: string }) {
  const [isCurrentUser] = useFixtureInput('isCurrentUser', true);

  return (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider
        currentUserId={isCurrentUser ? contactId : '~zod'}
        contacts={Object.values(exampleContacts)}
      >
        <EditProfileScreenView userId={contactId} onGoBack={() => {}} />
      </AppDataContextProvider>
    </FixtureWrapper>
  );
}

export default {
  'Full Profile': <EditProfileScreen contactId={exampleContacts.base.id} />,
};
