import { SettingUpScreen } from '../../Onboarding';
import { FIRST_RUN_STEPS, firstRunCopy } from './firstRunCopy';

/**
 * Shown only when the last screen's buttons are tapped before setup is done:
 * signup's Setting up screen, on its last step. The chat opens by itself once
 * setup is ready, or once it runs late and carries on in the background.
 */
export function FirstRunSetupScreen() {
  return (
    <SettingUpScreen
      body={firstRunCopy.setup.waitingBody}
      current="bot"
      step={FIRST_RUN_STEPS.workspace}
    />
  );
}
