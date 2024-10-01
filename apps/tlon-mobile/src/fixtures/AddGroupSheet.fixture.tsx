import { AddGroupSheet, AppDataContextProvider } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { initialContacts } from './fakeData';

export default {
  basic: (
    <FixtureWrapper>
      <AppDataContextProvider contacts={initialContacts} currentUserId="zod">
        <AddGroupSheet
          open
          onOpenChange={() => {}}
          onGoToDm={() => {}}
          navigateToFindGroups={() => {}}
          navigateToCreateGroup={() => {}}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
