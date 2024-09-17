import { AddGroupSheet, AppDataContextProvider } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper>
      <AppDataContextProvider contacts={initialContacts}>
        <AddGroupSheet
          open
          onOpenChange={() => {}}
          onGoToDm={() => {}}
          onCreatedGroup={() => {}}
          navigateToFindGroups={() => {}}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
