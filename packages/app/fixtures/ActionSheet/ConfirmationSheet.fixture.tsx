import { ConfirmationSheet } from '../../ui';
import { INVITATION_WARNINGS } from '../../ui/constants/warningMessages';

export default (
  <ConfirmationSheet
    open={true}
    onOpenChange={() => {}}
    confirmAction={() => {}}
    title="Kick ~sampel-palnet?"
    subtitle="This user will be removed from the group."
    warningMessage={INVITATION_WARNINGS.KICK_USER}
    confirmButtonTitle="Kick User"
    confirmButtonType="negative"
  />
);