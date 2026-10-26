import { Button } from '@tloncorp/ui';
import { YStack } from 'tamagui';

import { OnboardingStepLayout, SetupStepList } from '../../Onboarding';
import { firstRunCopy } from './firstRunCopy';

const copy = firstRunCopy.setup;

/**
 * Shown only when "Let's get started" is tapped before setup is done: the
 * same checklist as signup's Setting up screen. While it waits, the DM opens
 * by itself; if setup stopped, Retry picks up where it left off.
 */
export function FirstRunSetupScreen({
  failed,
  onRetry,
  onSkip,
}: {
  failed: boolean;
  onRetry: () => void;
  /** Leave without the Tlonbot for now, so a stuck setup can't trap anyone. */
  onSkip?: () => void;
}) {
  const [computer, network, bot] = copy.steps;
  return (
    <OnboardingStepLayout
      title={failed ? copy.failedTitle : copy.waitingTitle}
      body={failed ? copy.failedBody : copy.waitingBody}
      footer={
        failed ? (
          <YStack gap="$xs">
            <Button
              preset="hero"
              shadow
              label={copy.retry}
              onPress={onRetry}
              testID="first-run-setup-retry"
            />
            {onSkip ? (
              <Button
                preset="minimal"
                intent="secondary"
                centered
                label={copy.skip}
                onPress={onSkip}
                testID="first-run-setup-skip"
              />
            ) : null}
          </YStack>
        ) : undefined
      }
    >
      <SetupStepList
        failedLabel={copy.didNotFinish}
        steps={[
          { label: computer, state: 'done' },
          { label: network, state: 'done' },
          { label: bot, state: failed ? 'failed' : 'current' },
        ]}
      />
    </OnboardingStepLayout>
  );
}
