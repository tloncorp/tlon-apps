import * as Contacts from 'expo-contacts';
import * as LibPhone from 'libphonenumber-js';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';

const logger = createDevLogger('SystemContactsApi', true);

export async function getSystemContacts(): Promise<db.SystemContact[]> {
  const { status } = await Contacts.getPermissionsAsync();
  if (status !== 'granted') {
    return [];
  }

  const { data: nativeContactBook } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
  });
  try {
    const processedContacts = parseNativeContacts(nativeContactBook);
    return processedContacts;
  } catch (e) {
    logger.trackEvent(domain.AnalyticsEvent.ErrorSystemContacts, {
      context: 'failed to parse native contacts',
      severity: domain.AnalyticsSeverity.High,
    });
    return [];
  }
}

export function parseNativeContacts(
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
