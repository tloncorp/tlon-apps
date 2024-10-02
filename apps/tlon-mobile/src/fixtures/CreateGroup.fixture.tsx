import { AppDataContextProvider, CreateGroupView } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={initialContacts}>
        <CreateGroupView goBack={() => {}} navigateToChannel={() => {}} />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
