import * as db from '@tloncorp/shared/db';

import { ActionSheet } from '../ActionSheet';
import { SplashSequence } from './SplashSequence';

export function SplashModal(props: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const hostingBotEnabled = db.hostingBotEnabled.useValue();

  return (
    <ActionSheet
      mode="dialog"
      open={props.open}
      onOpenChange={props.setOpen}
      dialogContentProps={{ width: 600, height: 700 }}
    >
      <ActionSheet.Content flex={1} overflow="hidden">
        <SplashSequence
          onCompleted={() => {}}
          hostingBotEnabled={hostingBotEnabled ?? false}
        />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
