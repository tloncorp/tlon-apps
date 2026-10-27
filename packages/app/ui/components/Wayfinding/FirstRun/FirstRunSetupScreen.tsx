import { OnboardingStepLayout, SetupStepList } from '../../Onboarding';
import { firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.setup;

/**
 * Shown only when "Let's get started" is tapped before setup is done: the
 * same checklist as signup's Setting up screen. The chat opens by itself once
 * setup is ready, or once it runs late and carries on in the background.
 */
export function FirstRunSetupScreen() {
  const [computer, network, bot] = copy.steps;
  return (
    <OnboardingStepLayout title={copy.waitingTitle} body={copy.waitingBody}>
      <SetupStepList
        steps={[
          { label: computer, state: 'done' },
          { label: network, state: 'done' },
          { label: bot, state: 'current' },
        ]}
      />
    </OnboardingStepLayout>
  );
}
