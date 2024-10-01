import { AppDataContextProvider, FindGroupsView } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper fillWidth fillHeight>
      <AppDataContextProvider contacts={initialContacts}>
        <FindGroupsView goBack={() => {}} goToContactHostedGroups={() => {}} />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
