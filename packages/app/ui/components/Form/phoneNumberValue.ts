import {
  type PhoneNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import { COUNTRY_PHONE_DATA } from 'react-native-transformer-text-input/formatters/phone-data';
import { detectCountry } from 'react-native-transformer-text-input/formatters/phone-number';

export function getCallingCode(country: string): string {
  return COUNTRY_PHONE_DATA[country]?.callingCode ?? '';
}

export function getFlag(country: string): string {
  return COUNTRY_PHONE_DATA[country]?.flag ?? '';
}

// Resolve the country (for the flag) from the international text as the user
// types. libphonenumber only assigns a country once the national number is
// complete, so for NANP (+1, shared by US/CA/Caribbean) the flag would stay on
// the calling-code default until the final digit. Once the 3-digit area code is
// present, pad it to a full valid number (a 2xx-xxxx national part) so
// libphonenumber resolves the territory from the area code alone (e.g. +1 514
// -> CA, +1 876 -> JM). Falls back to the calling-code primary while shorter.
export function detectCountryFromInput(
  value: string,
  parsed: PhoneNumber | undefined = parsePhoneNumberFromString(value)
): string | undefined {
  if (parsed?.country) return parsed.country;

  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length >= 4) {
    const areaCode = digits.slice(1, 4);
    const byAreaCode = parsePhoneNumberFromString(
      `+1${areaCode}2000000`
    )?.country;
    if (byAreaCode) return byAreaCode;
  }
  return detectCountry(value);
}

// Normalize the international text shown in the input to a stored E.164 value.
// Uses libphonenumber-js so the result matches what isValidPhoneNumber accepts;
// partial/invalid input falls back to a "+digits" value that validation rejects.
export function toE164(
  value: string,
  parsed: PhoneNumber | undefined = parsePhoneNumberFromString(value)
): string {
  if (parsed) {
    return parsed.number;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? `+${digits}` : '';
}

// Parse the input once and derive both the flag country and the stored E.164
// value, so a keystroke handler doesn't parse the same text twice.
export function parsePhoneInput(value: string): {
  country: string | undefined;
  e164: string;
} {
  const parsed = parsePhoneNumberFromString(value);
  return {
    country: detectCountryFromInput(value, parsed),
    e164: toE164(value, parsed),
  };
}
