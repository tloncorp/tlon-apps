import { configureSystemContactsProvider } from '@tloncorp/api';
import type { SystemContact } from '@tloncorp/api/types';
import { createDevLogger } from '@tloncorp/shared';
import * as Contacts from 'expo-contacts';
import * as Localization from 'expo-localization';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

const logger = createDevLogger('mobileSystemContactsProvider', true);

function normalizePhoneNumber(
  number: string | undefined,
  digits: string | undefined,
  defaultCountryCode: string
) {
  const countryCode = defaultCountryCode as CountryCode;
  const tryParse = (value: string | undefined): string | null => {
    if (!value) {
      return null;
    }

    try {
      const parsed = parsePhoneNumberFromString(value, countryCode);
      return parsed?.isValid() ? parsed.number : null;
    } catch (_err) {
      return null;
    }
  };

  const normalizedFromDigits = tryParse(digits);
  if (normalizedFromDigits) {
    return normalizedFromDigits;
  }

  const normalizedFromNumber = tryParse(number);
  if (normalizedFromNumber) {
    return normalizedFromNumber;
  }

  const raw = digits || number;
  if (!raw) {
    return null;
  }

  if (raw.startsWith('00')) {
    const normalized = `+${raw.slice(2).replace(/\D/g, '')}`;
    return normalized.length > 1 ? normalized : null;
  }

  if (raw.startsWith('+')) {
    const normalized = '+' + raw.slice(1).replace(/\D/g, '');
    return normalized.length > 1 ? normalized : null;
  }

  const normalizedDigits = raw.replace(/\D/g, '');
  if (!normalizedDigits) {
    return null;
  }

  if (normalizedDigits.length === 10 && defaultCountryCode === 'US') {
    return `+1${normalizedDigits}`;
  }

  return `+${normalizedDigits}`;
}

const mobileSystemContactsProvider = async (): Promise<SystemContact[]> => {
  const { status } = await Contacts.getPermissionsAsync();
  if (status !== 'granted') {
    return [];
  }

  let defaultCountryCode = 'US';
  try {
    const locale = Localization.getLocales()[0];
    if (locale?.regionCode) {
      defaultCountryCode = locale.regionCode.toUpperCase();
    }
  } catch (e) {
    logger.log('Could not infer system default country code', e);
  }

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
  });

  return data
    .map((contact): SystemContact | null => {
      const phone = normalizePhoneNumber(
        contact.phoneNumbers?.[0]?.number,
        contact.phoneNumbers?.[0]?.digits,
        defaultCountryCode
      );
      const email = contact.emails?.[0]?.email;
      const hasName = Boolean(contact.firstName || contact.lastName);
      const hasContactInfo = Boolean(phone || email);
      if (!hasName || !hasContactInfo || !contact.id) {
        return null;
      }
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phoneNumber: phone ?? undefined,
        email: email ?? undefined,
      };
    })
    .filter((c): c is SystemContact => c != null);
};

export function configureMobileSystemContactsProvider() {
  configureSystemContactsProvider(mobileSystemContactsProvider);
}
