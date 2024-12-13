import { AppDataContextProvider, InviteUsersSheet } from '@tloncorp/ui';
import { VerifyPhoneNumberSheet } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { group, initialContacts } from './fakeData';

export default {
  loading: (
    <FixtureWrapper>
      <AppDataContextProvider
        currentUserId="~latter-bolden"
        contacts={initialContacts}
      >
        <VerifyPhoneNumberSheet
          open
          onOpenChange={() => {}}
          verification={null}
          verificationLoading={true}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
  inputPhone: (
    <FixtureWrapper>
      <AppDataContextProvider
        currentUserId="~latter-bolden"
        contacts={initialContacts}
      >
        <VerifyPhoneNumberSheet
          open
          onOpenChange={() => {}}
          verification={null}
          verificationLoading={false}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
  inputOtp: (
    <FixtureWrapper>
      <AppDataContextProvider
        currentUserId="~latter-bolden"
        contacts={initialContacts}
      >
        <VerifyPhoneNumberSheet
          open
          onOpenChange={() => {}}
          verification={{
            type: 'phone',
            value: '+1 (262)-388-1275',
            status: 'pending',
            visibility: 'discoverable',
          }}
          verificationLoading={false}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
  success: (
    <FixtureWrapper>
      <AppDataContextProvider
        currentUserId="~latter-bolden"
        contacts={initialContacts}
      >
        <VerifyPhoneNumberSheet
          open
          onOpenChange={() => {}}
          verification={{
            type: 'phone',
            value: '+1 (262)-388-1275',
            status: 'verified',
            visibility: 'discoverable',
          }}
          verificationLoading={false}
        />
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
