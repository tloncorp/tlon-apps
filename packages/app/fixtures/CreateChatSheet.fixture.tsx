import { CreateChatSheet } from '../features/top/CreateChatSheet';
import { AppDataContextProvider } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { savedContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper>
      <AppDataContextProvider contacts={savedContacts} currentUserId="zod">
        <CreateChatSheet defaultOpen={true} trigger={<button>Open</button>} />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
