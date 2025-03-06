import * as db from '@tloncorp/shared/db';

import {
  AppDataContextProvider,
  AttestationScreenView,
  PostScreenView,
} from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import {
  createFakePosts,
  group,
  initialContacts,
  tlonLocalBulletinBoard,
} from './fakeData';

const posts = createFakePosts(10);

const INITIAL: db.Verification | null = null;

const CONFIRM: db.Verification = {
  type: 'twitter',
  status: 'pending',
  provider: '~zod',
  value: '@gardener',
  visibility: 'public',
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
        <AttestationScreenView
          attestationType="twitter"
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
        <AttestationScreenView
          attestationType="twitter"
          attestation={CONFIRM}
          isLoading={false}
          currentUserId="~fabled-faster"
        />
      </FixtureWrapper>
    </AppDataContextProvider>
  ),
};
