import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';

import { TlonbotSetupScreenView } from '../screens/Onboarding/TlonbotSetupScreen';

export default function TlonbotSetupScreenFixture() {
  return (
    <FixtureWrapper>
      <TlonbotSetupScreenView />
    </FixtureWrapper>
  );
}
