import { spyOn } from '@tloncorp/shared';
import { useMemo } from 'react';

import {
  AppDataContextProvider,
  InviteUsersSheet,
  StoreProvider,
  createNoOpStore,
} from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, initialContacts } from './fakeData';

function InviteUsersSheetFixture() {
  const store = useMemo(() => {
    const noOpStore = createNoOpStore();
    const mockUseGroup = () => ({
      data: group,
      isLoading: false,
      error: null,
    });

    // @ts-expect-error - fixture mock
    return spyOn(noOpStore, 'useGroup', mockUseGroup);
  }, []);

  return (
    <StoreProvider stub={store}>
      <FixtureWrapper>
        <AppDataContextProvider currentUserId="~zod" contacts={initialContacts}>
          <InviteUsersSheet
            open
            onOpenChange={() => {}}
            onInviteComplete={() => {}}
            groupId={group.id}
          />
        </AppDataContextProvider>
      </FixtureWrapper>
    </StoreProvider>
  );
}

export default {
  basic: <InviteUsersSheetFixture />,
};
