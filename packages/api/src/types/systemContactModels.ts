import type { Contact } from './chatModels';

export interface SystemContact {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  contactId?: string | null;
}

export interface SystemContactSentInvite {
  invitedTo?: string | null;
  systemContactId?: string | null;
  invitedAt?: number | null;
}

export function isSystemContact(
  contact: Contact | SystemContact
): contact is SystemContact {
  const hasPhone = 'phoneNumber' in contact;
  const hasEmail = 'email' in contact;
  return hasPhone || hasEmail;
}
