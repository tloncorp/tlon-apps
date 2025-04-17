import { createDevLogger } from '@tloncorp/shared';
import * as domain from '@tloncorp/shared/domain';
import { AnalyticsEvent } from '@tloncorp/shared/domain';
import * as Contacts from 'expo-contacts';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import * as LibPhone from 'libphonenumber-js';
import { Alert } from 'react-native';

const logger = createDevLogger('ContactsHelpers', true);

export async function inviteSystemContacts(
  params: domain.SystemContactInviteParams
): Promise<boolean> {
  if (!params.recipients.length) {
    return false;
  }

  if (params.type === 'sms') {
    logger.trackEvent(AnalyticsEvent.ActionContactBookInviteShown, {
      type: 'sms',
      numRecipients: params.recipients.length,
    });

    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'initiated sms invite, but system sms not available',
      });
      Alert.alert(
        'SMS Invites Unavailable',
        'Please configure a default SMS app and try again.'
      );
      return false;
    }

    const response = await SMS.sendSMSAsync(
      params.recipients,
      `${params.invite.link}
${params.invite.message}`
    );

    if (response.result === 'sent') {
      logger.trackEvent(AnalyticsEvent.ActionContactBookInviteSent, {
        type: 'sms',
        numRecipients: params.recipients.length,
      });
      return true;
    } else {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'invite opened, but not sent',
        type: 'sms',
        numRecipients: params.recipients.length,
        actionStatus: response.result,
      });
    }
    return false;
  }

  if (params.type === 'email') {
    logger.trackEvent(AnalyticsEvent.ActionContactBookInviteShown, {
      type: 'email',
      numRecipients: params.recipients.length,
    });

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'initiated email invite, but system email not available',
      });
      Alert.alert(
        'Email Invites Unavailable',
        'Please sign into your system email app and try again.'
      );
      return false;
    }
    const result = await MailComposer.composeAsync({
      recipients: params.recipients,
      subject: params.invite.subject ?? `You're Invited to Tlon Messenger!`,
      body: `${params.invite.message}
${params.invite.link}`,
    });

    if (result.status === MailComposer.MailComposerStatus.SENT) {
      logger.trackEvent(AnalyticsEvent.ActionContactBookInviteSent, {
        type: 'email',
        numRecipients: params.recipients.length,
      });
      return true;
    } else {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'invite opened, but not sent',
        type: 'email',
        numRecipients: params.recipients.length,
        actionStatus: result.status,
      });
    }
    return false;
  }
  return false;
}

export async function getSystemContactBook(): Promise<domain.SystemContact[]> {
  const { data: nativeContactBook } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
  });
  const processedContacts = processNativeContacts(nativeContactBook);
  return processedContacts;
}

export function processNativeContacts(
  nativeContacts: Contacts.Contact[]
): domain.SystemContact[] {
  const parsed = nativeContacts
    .filter((contact) => {
      const hasPhoneNumbers =
        contact.phoneNumbers && contact.phoneNumbers.length > 0;
      const hasEmails = contact.emails && contact.emails.length > 0;
      return hasPhoneNumbers || hasEmails;
    })
    .map((contact) => {
      // Extract and format phone numbers
      const phoneNumbers = (contact.phoneNumbers || [])
        .map((phoneRecord) => {
          // Skip if no number
          if (!phoneRecord.number) return null;

          // Get country code from the record or fallback to 'US'
          const countryCode = (phoneRecord.countryCode || 'us').toUpperCase();

          try {
            // Try to parse using the provided country code
            if (LibPhone.isValidPhoneNumber(phoneRecord.number)) {
              const parsedNumber = LibPhone.parsePhoneNumberFromString(
                phoneRecord.number,
                countryCode as LibPhone.CountryCode
              );
              return parsedNumber?.format('E.164'); // Format as +12623881275
            }

            // If we have digits, we can try to use those directly with the country code
            if (phoneRecord.digits) {
              // For US numbers (10 digits)
              if (countryCode === 'US' && phoneRecord.digits.length === 10) {
                return `+1${phoneRecord.digits}`;
              }

              // For non-US numbers, try to parse the digits with country code
              try {
                const digitNumber = `+${phoneRecord.digits}`;
                if (LibPhone.isValidPhoneNumber(digitNumber)) {
                  return digitNumber;
                }
              } catch (_) {
                // Continue to fallback if this fails
              }
            }

            // Fallback: basic normalization
            const normalizedNumber = phoneRecord.number.replace(/\D/g, '');
            return normalizedNumber.length > 0 ? `+${normalizedNumber}` : null;
          } catch (error) {
            // Final fallback
            return phoneRecord.digits ? `+${phoneRecord.digits}` : null;
          }
        })
        .filter((num): num is string => num !== null);

      const sysContact: domain.SystemContact = {
        id: contact.id!,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phoneNumber: phoneNumbers.length > 0 ? phoneNumbers[0] : undefined,
        email: contact.emails?.[0]?.email,
      };

      return sysContact;
    })
    .filter((contact) => {
      return contact.phoneNumber || contact.email;
    });

  console.log(`bl: parsed system contacts`, parsed);
  return parsed;
}
