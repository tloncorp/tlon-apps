import * as db from '@tloncorp/shared/db';

import { useCurrentUserId } from '../contexts';
import { ActionSheet } from './ActionSheet';
import { AttestationPane } from './AttestationPane';

export function AttestationSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attestation?: db.Attestation | null;
}) {
  const currentUserId = useCurrentUserId();

  if (!props.attestation) {
    return null;
  }

  return (
    <ActionSheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      snapPointsMode="percent"
      snapPoints={[80]}
    >
      <ActionSheet.MainContent marginTop="$xl" justifyContent="flex-start">
        <AttestationPane
          attestation={props.attestation}
          currentUserId={currentUserId}
        />
      </ActionSheet.MainContent>
    </ActionSheet>
  );
}
