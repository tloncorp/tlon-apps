import * as Contacts from 'expo-contacts';
import * as LibPhone from 'libphonenumber-js';

export interface TlonContact {
  id: string;
  name: string;
  phoneNumbers: string[];
}

export function processNativeContacts(
  nativeContacts: Contacts.Contact[]
): TlonContact[] {
  return nativeContacts
    .filter((contact) => {
      // Filter out contacts without phone numbers
      return contact.phoneNumbers && contact.phoneNumbers.length > 0;
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

      return {
        id: contact.id!,
        name:
          contact.name ||
          `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
          'Unnamed Contact',
        phoneNumbers: [...new Set(phoneNumbers)], // Remove duplicates
      };
    })
    .filter((contact) => {
      // Final filter to ensure we only keep contacts with at least one phone number
      return contact.phoneNumbers.length > 0;
    });
}
