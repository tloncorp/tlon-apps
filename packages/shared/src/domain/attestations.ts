import * as LibPhone from 'libphonenumber-js';

export function parseForTwitterPostId(text: string): string | null {
  // If input is already just a numeric ID
  if (/^\d+$/.test(text)) {
    return text;
  }

  // Handle both twitter.com and x.com URLs with various prefixes
  const regex =
    /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i;
  const match = text.match(regex);

  if (match) {
    return match[1];
  }

  return null;
}

export function parseTwitterHandle(text: string): string {
  let handle = text;
  if (text.startsWith('@')) {
    handle = text.slice(1);
  }

  return handle.toLowerCase();
}

export function twitterHandleDisplay(text: string): string {
  if (text.startsWith('@')) {
    return text;
  }

  return `@${text}`;
}

export function displayablePhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    console.error('Cannot make displayable phone number, none passed in');
  }

  const parsed = LibPhone.parsePhoneNumberFromString(phoneNumber, 'US');
  if (!parsed) {
    return phoneNumber;
  }

  return parsed.format('INTERNATIONAL');
}
