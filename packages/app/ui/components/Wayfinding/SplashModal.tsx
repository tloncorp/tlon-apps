import * as db from '@tloncorp/shared/db';

import { ActionSheet } from '../ActionSheet';
import { AgentOnboardingSequence } from './AgentOnboarding/AgentOnboardingSequence';
import { SplashSequence } from './SplashSequence';

export function SplashModal(props: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const hostingBotEnabled = db.hostingBotEnabled.useValue();
  const complete = () => props.setOpen(false);
  const splash = (
    <SplashSequence
      onCompleted={complete}
      hostingBotEnabled={hostingBotEnabled ?? false}
    />
  );

  return (
    <ActionSheet
      mode="dialog"
      open={props.open}
      onOpenChange={props.setOpen}
      dialogContentProps={{ width: 600, height: 700 }}
    >
      <ActionSheet.Content flex={1} overflow="hidden">
        <AgentOnboardingSequence onCompleted={complete} fallback={splash} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
