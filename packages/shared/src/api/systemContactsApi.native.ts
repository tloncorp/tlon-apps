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
  const parseCounts = { digitFinds: 0, numberFinds: 0, fallbacks: 0 };

  // Add debugging to see what's getting filtered out initially
  logger.log(`Initial system contacts count: ${nativeContacts.length}`);

  const parsed = nativeContacts
    .filter((contact) => {
      const hasPhoneNumbers =
        contact.phoneNumbers && contact.phoneNumbers.length > 0;
      const hasEmails = contact.emails && contact.emails.length > 0;

      // Debug which contacts are being filtered out here
      if (!hasPhoneNumbers && !hasEmails) {
        logger.log(
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
            logger.log(
              `Contact ${contact.firstName} ${contact.lastName}: phone record ${index} has no number`,
              { phoneRecord }
            );
            return null;
          }

          // Get country code from the record or fallback to 'US'
          const countryCode = (phoneRecord.countryCode || 'us').toUpperCase();
          const originalNumber = phoneRecord.number;
          let formattedNumber = null;

          // Try first with digits + country code
          try {
            if (!phoneRecord.digits) {
              logger.log(
                `Contact ${contact.firstName} ${contact.lastName}: phone record has no digits`,
                { phoneRecord }
              );
            } else {
              try {
                const phoneDetails = LibPhone.parsePhoneNumberFromString(
                  phoneRecord.digits,
                  countryCode as LibPhone.CountryCode
                );
                if (!phoneDetails) {
                  logger.log(
                    `Contact ${contact.firstName} ${contact.lastName}: phone record ${index} could not parse digits + country code`,
                    { phoneRecord }
                  );
                } else {
                  const normalized = phoneDetails.format('E.164');
                  if (!normalized) {
                    logger.log(
                      `Contact ${contact.firstName} ${contact.lastName}: phone record ${index} could not format digits + country code`,
                      { phoneRecord }
                    );
                  } else {
                    formattedNumber = normalized;
                    parseCounts.digitFinds++;
                  }
                }
              } catch (e) {
                logger.log(
                  `Contact ${contact.firstName} ${contact.lastName}: threw while parsing for digits + country code`,
                  { phoneRecord, error: e }
                );
              }
            }

            // If that fails, try normalizing the display number
            if (!formattedNumber && phoneRecord.number) {
              try {
                const phoneDetails = LibPhone.parsePhoneNumberFromString(
                  phoneRecord.number
                );
                if (!phoneDetails) {
                  logger.log(
                    `Contact ${contact.firstName} ${contact.lastName}: phone record ${index} could not parse number`,
                    { phoneRecord }
                  );
                } else {
                  const normalized = phoneDetails.format('E.164');
                  if (!normalized) {
                    logger.log(
                      `Contact ${contact.firstName} ${contact.lastName}: phone record ${index} could not format number`,
                      { phoneRecord }
                    );
                  } else {
                    formattedNumber = normalized;
                    parseCounts.numberFinds++;
                  }
                }
              } catch (e) {
                logger.log(
                  `Contact ${contact.firstName} ${contact.lastName}: threw while parsing for number`,
                  { phoneRecord, error: e }
                );
              }
            }

            // If we still don't have a formatted number, use basic normalization
            if (!formattedNumber) {
              const normalizedNumber = phoneRecord.number.replace(/\D/g, '');
              if (normalizedNumber.length > 0) {
                formattedNumber = normalizedNumber.startsWith('+')
                  ? normalizedNumber
                  : `+${normalizedNumber}`;
                parseCounts.fallbacks++;
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
              `Error processing number for ${contact.firstName} ${contact.lastName}: ${error}`,
              { contact: JSON.stringify(contact), error }
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
      const hasContactInfo = contact.phoneNumber || contact.email;
      const hasName = contact.firstName || contact.lastName;
      const isValid = hasContactInfo && hasName;
      if (!isValid) {
        logger.log(
          `Final filter removed contact: ${contact.firstName} ${contact.lastName}`
        );
      }
      return isValid;
    });

  const numWithPhone = parsed.filter((c) => c.phoneNumber).length;
  const numWithEmail = parsed.filter((c) => c.email).length;
  logger.trackEvent('System Contact Parse Result', {
    ...parseCounts,
    numWithEmail,
    numWithPhone,
    numInput: nativeContacts.length,
    numOutput: parsed.length,
  });
  return parsed;
}
