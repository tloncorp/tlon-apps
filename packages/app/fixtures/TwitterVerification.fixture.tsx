import * as db from '@tloncorp/shared/db';

import { AppDataContextProvider, TwitterAttestationPane } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { createFakePosts, initialContacts } from './fakeData';

const posts = createFakePosts(10);

const INITIAL: db.Attestation | null = null;

const CONFIRM: db.Attestation = {
  id: '23jskj3',
  type: 'twitter',
  status: 'pending',
  provider: '~zod',
  value: '@gardener',
  discoverability: 'public',
  initiatedAt: Date.now(),
  contactId: '~latter-bolden',
};

export default {
  SubmitHandle: (
    <AppDataContextProvider
      contacts={initialContacts}
      calmSettings={{
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
      }}
    >
      <FixtureWrapper safeArea>
        <TwitterAttestationPane
          attestation={INITIAL}
          isLoading={false}
          currentUserId="~latter-bolden"
        />
      </FixtureWrapper>
    </AppDataContextProvider>
  ),
  Confirm: (
    <AppDataContextProvider
      contacts={initialContacts}
      calmSettings={{
        disableAvatars: false,
        disableNicknames: false,
        disableRemoteContent: false,
      }}
    >
      <FixtureWrapper safeArea>
        <TwitterAttestationPane
          attestation={CONFIRM}
          isLoading={false}
          currentUserId="~fabled-faster"
        />
      </FixtureWrapper>
    </AppDataContextProvider>
  ),
};
