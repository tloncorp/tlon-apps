export interface SystemContact {
  id: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
}

export const InvitedToPersonalKey = 'personal-invite';

export interface SystemContactInviteParams {
  type: 'sms' | 'email';
  recipients: string[];
  invite: {
    link: string;
    message: string;
    subject?: string;
  };
}

export const SystemContactInviteMessages = {
  Personal: `I'm inviting you to Tlon Messenger`,
};
