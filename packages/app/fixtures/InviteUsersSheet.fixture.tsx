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
    const mockUseGroup = ({ id }: { id?: string }) => ({
      data: id ? group : undefined,
      isLoading: false,
      error: null,
      isSuccess: !!id,
      isError: false,
      refetch: () => Promise.resolve(),
      queryKey: ['group', id],
      enabled: !!id,
    });

    // @ts-expect-error - fixture mock
    return spyOn(baseStore, 'useGroup', mockUseGroup);
  }, []);

  return (
    <FixtureWrapper>
      <StoreProvider stub={store}>
        <AppDataContextProvider currentUserId="~zod" contacts={initialContacts}>
          <InviteUsersSheet
            open
            onOpenChange={() => {}}
            onInviteComplete={() => {}}
            groupId={group.id}
          />
        </AppDataContextProvider>
      </StoreProvider>
    </FixtureWrapper>
  );
}

export default {
  basic: <InviteUsersSheetFixture />,
};
