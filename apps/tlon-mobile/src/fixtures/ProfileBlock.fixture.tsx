import { AppDataContextProvider, View } from '@tloncorp/ui';
import { ProfileBlock } from '@tloncorp/ui/src/components/ProfileBlock';

import { FixtureWrapper } from './FixtureWrapper';
import { brianContact } from './fakeData';

const lightBg =
  'https://storage.googleapis.com/tlon-prod-memex-assets/solfer-magfed/solfer-magfed/2024.8.10..17.17.3..6624.dd2f.1a9f.be76-Untitled-3.png';

export default {
  noBg: (
    <FixtureWrapper fillWidth>
      <AppDataContextProvider
        contacts={[{ ...brianContact, coverImage: null }]}
      >
        <View padding="$xl" width={'100%'}>
          <ProfileBlock contactId={brianContact.id} />
        </View>
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
  darkBg: (
    <FixtureWrapper fillWidth>
      <AppDataContextProvider contacts={[brianContact]}>
        <View padding="$xl" width={'100%'}>
          <ProfileBlock contactId={brianContact.id} />
        </View>
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
  lightBg: (
    <FixtureWrapper fillWidth>
      <AppDataContextProvider
        contacts={[{ ...brianContact, coverImage: lightBg }]}
      >
        <View padding="$xl" width={'100%'}>
          <ProfileBlock contactId={brianContact.id} />
        </View>
      </AppDataContextProvider>
    </FixtureWrapper>
  ),
};
