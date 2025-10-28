import { ConfirmationSheet } from '../../ui';
import { INVITATION_WARNINGS } from '../../ui/constants/warningMessages';

export default (
  <ConfirmationSheet
    open={true}
    onOpenChange={() => {}}
    confirmAction={() => {}}
    title="Leave Test Group?"
    subtitle="You will no longer receive updates from this group."
    warningMessage={INVITATION_WARNINGS.LEAVE_GROUP}
    confirmButtonTitle="Leave Group"
    confirmButtonType="negative"
  />
);