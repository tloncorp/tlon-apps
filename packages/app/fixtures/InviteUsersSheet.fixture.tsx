import * as baseStore from '@tloncorp/shared/store';
import { useMemo } from 'react';

import { AppDataContextProvider, InviteUsersSheet, StoreProvider } from '../ui';
import { FixtureWrapper } from './FixtureWrapper';
import { group, initialContacts } from './fakeData';

function spyOn<T extends object, MethodName extends keyof T>(
  base: T,
  method: MethodName,
  fn: T[MethodName]
) {
  return new Proxy(base, {
    get(target, prop) {
      if (prop === method) {
        return fn;
      }
      return target[prop as keyof T];
    },
  });
}

function InviteUsersSheetFixture() {
  const store = useMemo(() => {
    const mockUseGroup = () => ({
      data: group,
      isLoading: false,
      error: null,
    });

    // @ts-expect-error - fixture mock
    return spyOn(baseStore, 'useGroup', mockUseGroup);
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
