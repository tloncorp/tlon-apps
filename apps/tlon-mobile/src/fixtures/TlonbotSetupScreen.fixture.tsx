import { FixtureWrapper } from '@tloncorp/app/fixtures/FixtureWrapper';
import { useFixtureSelect } from 'react-cosmos/client';

import {
  TlonbotSetupScreenView,
  TlonbotSetupStep,
} from '../screens/Onboarding/TlonbotSetupScreen';

const setupSteps: TlonbotSetupStep[] = ['provisioning', 'applying'];

export default function TlonbotSetupScreenFixture() {
  const [step] = useFixtureSelect('step', {
    defaultValue: 'provisioning',
    options: setupSteps,
  });

  return (
    <FixtureWrapper
      fillWidth
      fillHeight
      safeArea={false}
      innerBackgroundColor="$secondaryBackground"
    >
      <TlonbotSetupScreenView step={step as TlonbotSetupStep} />
    </FixtureWrapper>
  );
}
