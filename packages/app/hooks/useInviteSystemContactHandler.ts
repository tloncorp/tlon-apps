import * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import * as store from '@tloncorp/shared/store';
import { triggerHaptic } from '@tloncorp/ui';
import { useCallback } from 'react';

export type InviteSystemContactsFn = (
  params: domain.SystemContactInviteParams
) => Promise<boolean>;

export function useInviteSystemContactHandler(
  inviteSystemContacts?: InviteSystemContactsFn,
  inviteLink?: string | null
) {
  const handleInviteSystemContact = useCallback(
    async (systemContact: db.SystemContact) => {
      if (!inviteSystemContacts || !inviteLink) {
        triggerHaptic('error');
        return;
      }

      const alreadyInvited = !!systemContact.sentInvites?.find(
        (invite) => invite.invitedTo === domain.InvitedToPersonalKey
      );
      if (alreadyInvited) {
        triggerHaptic('error');
        return;
      }

      const inviteType = systemContact.phoneNumber ? 'sms' : 'email';
      const recipient =
        inviteType === 'sms' ? systemContact.phoneNumber : systemContact.email;

      if (!recipient) {
        triggerHaptic('error');
        return;
      }

      triggerHaptic('baseButtonClick');
      const params: domain.SystemContactInviteParams = {
        type: inviteType,
        recipients: [recipient],
        invite: {
          link: inviteLink,
          message: domain.SystemContactInviteMessages.Personal,
        },
      };
      const didSend = await inviteSystemContacts(params);
      if (didSend) {
        await store.recordSentInvites(domain.InvitedToPersonalKey, [
          systemContact,
        ]);
      }
    },
    [inviteSystemContacts, inviteLink]
  );

  return handleInviteSystemContact;
}
