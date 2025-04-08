import { Dialog } from 'tamagui';

import { ActionSheet } from '../ActionSheet';
import { SplashSequence } from './SplashSequence';

export function SplashModal(props: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <ActionSheet
      mode="dialog"
      open={props.open}
      onOpenChange={props.setOpen}
      dialogContentProps={{ width: 600, height: 700 }}
    >
      <ActionSheet.Content flex={1}>
        <SplashSequence onCompleted={() => {}} />
      </ActionSheet.Content>
    </ActionSheet>
  );
}
