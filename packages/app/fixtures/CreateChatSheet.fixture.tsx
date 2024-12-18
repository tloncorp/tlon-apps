import { AppDataContextProvider } from '@tloncorp/ui';

import { CreateChatSheet } from '../features/top/CreateChatSheet';
import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper>
      <AppDataContextProvider contacts={initialContacts} currentUserId="zod">
        <CreateChatSheet defaultOpen={true} />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
