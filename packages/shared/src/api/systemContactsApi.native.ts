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
  // Add debugging to see what's getting filtered out initially
  logger.trackEvent(`Initial system contacts count: ${nativeContacts.length}`);

  const parsed = nativeContacts
    .filter((contact) => {
      const hasPhoneNumbers =
        contact.phoneNumbers && contact.phoneNumbers.length > 0;
      const hasEmails = contact.emails && contact.emails.length > 0;

      // Debug which contacts are being filtered out here
      if (!hasPhoneNumbers && !hasEmails) {
        logger.trackEvent(
          `Filtered out system contact with no phone/email: ${contact.firstName} ${contact.lastName}`
        );
      }

      return hasPhoneNumbers || hasEmails;
    })
    .map((contact) => {
      // Extract and format phone numbers
      const phoneNumbers = (contact.phoneNumbers || [])
        .map((phoneRecord, index) => {
          // Skip if no number
          if (!phoneRecord.number) {
            logger.trackEvent(
              `Contact ${contact.firstName} ${contact.lastName}: phone record ${index} has no number`,
              { phoneRecord }
            );
            return null;
          }

          // Get country code from the record or fallback to 'US'
          const countryCode = (phoneRecord.countryCode || 'us').toUpperCase();
          const originalNumber = phoneRecord.number;
          let formattedNumber = null;

          try {
            // Try to parse using the provided country code
            if (LibPhone.isValidPhoneNumber(phoneRecord.number)) {
              try {
                const parsedNumber = LibPhone.parsePhoneNumberFromString(
                  phoneRecord.number,
                  countryCode as LibPhone.CountryCode
                );
                formattedNumber = parsedNumber?.format('E.164');
              } catch (e) {
                logger.trackEvent(
                  `Failed to format number ${phoneRecord.number} with country ${countryCode}: ${e}`,
                  { error: e, contact: JSON.stringify(contact) }
                );
              }
            }

            // If we haven't got a valid number yet and we have digits, try those
            if (!formattedNumber && phoneRecord.digits) {
              // For US numbers (10 digits)
              if (countryCode === 'US' && phoneRecord.digits.length === 10) {
                formattedNumber = `+1${phoneRecord.digits}`;
              } else {
                // For non-US numbers, try to parse the digits with country code
                try {
                  const digitNumber = phoneRecord.digits.startsWith('+')
                    ? phoneRecord.digits
                    : `+${phoneRecord.digits}`;
                  if (LibPhone.isValidPhoneNumber(digitNumber)) {
                    formattedNumber = digitNumber;
                  }
                } catch (e) {
                  logger.log(
                    `Failed to format digits ${phoneRecord.digits}: ${e}`
                  );
                }
              }
            }

            // If we still don't have a formatted number, use basic normalization
            if (!formattedNumber) {
              const normalizedNumber = phoneRecord.number.replace(/\D/g, '');
              if (normalizedNumber.length > 0) {
                formattedNumber = normalizedNumber.startsWith('+')
                  ? normalizedNumber
                  : `+${normalizedNumber}`;
              }
            }

            // Debug the outcome
            if (!formattedNumber) {
              logger.log(
                `Contact ${contact.firstName} ${contact.lastName}: Failed to format number ${originalNumber}`
              );
            }

            return formattedNumber;
          } catch (error) {
            logger.log(
              `Error processing number for ${contact.firstName} ${contact.lastName}: ${error}`
            );
            // Final fallback with more careful checking
            if (phoneRecord.digits) {
              return phoneRecord.digits.startsWith('+')
                ? phoneRecord.digits
                : `+${phoneRecord.digits}`;
            }
            // Just return the original number as last resort
            return phoneRecord.number;
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

      // Debug contacts that don't have phone numbers after processing
      if ((contact.phoneNumbers?.length ?? 0) > 0 && !sysContact.phoneNumber) {
        logger.log(
          `Contact ${contact.firstName} ${contact.lastName} lost phone number during formatting`,
          {
            systemPhoneData: JSON.stringify(contact.phoneNumbers),
            contact: JSON.stringify(contact),
          }
        );
      }

      return sysContact;
    })
    .filter((contact) => {
      const isValid = contact.phoneNumber || contact.email;
      if (!isValid) {
        logger.trackEvent(
          `Final filter removed contact: ${contact.firstName} ${contact.lastName}`
        );
      }
      return isValid;
    });

  logger.trackEvent(
    `Input contacts: ${nativeContacts.length}, Output contacts: ${parsed.length}`
  );
  const numWithPhone = parsed.filter((c) => c.phoneNumber).length;
  const numWithEmail = parsed.filter((c) => c.email).length;
  logger.trackEvent(
    `Num contacts with phone: ${numWithPhone}, with email: ${numWithEmail}`
  );
  return parsed;
}
