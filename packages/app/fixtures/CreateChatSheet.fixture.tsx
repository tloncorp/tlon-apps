import { CreateChatSheet } from '../features/top/CreateChatSheet';
import { AppDataContextProvider } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper>
      <AppDataContextProvider contacts={initialContacts} currentUserId="zod">
        <CreateChatSheet defaultOpen={true} trigger={<button>Open</button>} />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
