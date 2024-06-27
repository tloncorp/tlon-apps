import { ProfileDisplayWidget, View } from '@tloncorp/ui';

import { FixtureWrapper } from './FixtureWrapper';
import { brianContact, danContact, markContact } from './fakeData';

export default {
  'with cover': () => (
    <FixtureWrapper
      fillWidth
      backgroundColor="$background"
      verticalAlign="center"
    >
      <View paddingHorizontal="$xl">
        <ProfileDisplayWidget
          debugMessage=""
          contact={brianContact}
          contactId={brianContact.id}
        />
      </View>
    </FixtureWrapper>
  ),
  'with nickname': () => (
    <FixtureWrapper
      fillWidth
      backgroundColor="$background"
      verticalAlign="center"
    >
      <View paddingHorizontal="$xl">
        <ProfileDisplayWidget
          contact={danContact}
          contactId={danContact.id}
          debugMessage=""
        />
      </View>
    </FixtureWrapper>
  ),
  base: () => (
    <FixtureWrapper
      fillWidth
      backgroundColor="$background"
      verticalAlign="center"
    >
      <View paddingHorizontal="$xl">
        <ProfileDisplayWidget
          contact={markContact}
          contactId={markContact.id}
          debugMessage=""
        />
      </View>
    </FixtureWrapper>
  ),
};
