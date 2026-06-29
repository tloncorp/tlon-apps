import { Flag } from './hark';

export interface Contact {
  nickname: string;
  bio: string;
  status: string;
  color: string;
  avatar: string | null;
  cover: string | null;
  groups: string[];
  ['lanyard-twitter-0-sign']?: AttestationSignature;
  ['lanyard-phone-0-sign']?: AttestationSignature;
  ['lanyard-twitter-0-url']?: AttestationProviderUrl;
  ['lanyard-phone-0-url']?: AttestationProviderUrl;
}

export interface ContactAddGroup {
  'add-group': Flag;
}

export interface ContactDelGroup {
  'del-group': Flag;
}

export type ContactEditField =
  | Pick<Contact, 'nickname'>
  | Pick<Contact, 'bio'>
  | Pick<Contact, 'status'>
  | Pick<Contact, 'color'>
  | Pick<Contact, 'avatar'>
  | Pick<Contact, 'cover'>
  | ContactAddGroup
  | ContactDelGroup;

export type ContactsAction = ContactAnon | ContactEdit | ContactHeed;

export interface ContactAnon {
  anon: null;
}

export interface ContactEdit {
  edit: ContactEditField[];
}

export interface ContactHeed {
  heed: string[];
}

export type ContactRolodex = Record<string, Contact | null>;

export interface ContactNews {
  who: string;
  con: Contact | null;
}

export interface ContactFieldText {
  type: 'text';
  value: string;
}

export interface ContactImageField {
  type: 'look';
  value: string;
}

export interface ContactFieldColor {
  type: 'tint';
  value: string;
}

export interface ContactFieldGroups {
  type: 'set';
  value: { type: 'flag'; value: string }[];
}

export interface AttestationSignature {
  type: 'text';
  value: string;
}

export interface AttestationProviderUrl {
  type: 'text';
  value: string;
}

export interface ContactBookProfile {
  nickname?: ContactFieldText;
  bio?: ContactFieldText;
  avatar?: ContactImageField;
  cover?: ContactImageField;
  color?: ContactFieldColor;
  groups?: ContactFieldGroups;
  status?: ContactFieldText;
  // Convention field: a ship publishes the display profiles of the bots
  // ("virtual identities", i.e. moons) it owns here, as JSON. See
  // `BotProfilesField` / parseBotProfiles in contactsApi.
  bots?: ContactFieldText;
  ['lanyard-twitter-0-sign']?: AttestationSignature;
  ['lanyard-phone-0-sign']?: AttestationSignature;
  ['lanyard-twitter-0-url']?: AttestationProviderUrl;
  ['lanyard-phone-0-url']?: AttestationProviderUrl;
}

// Decoded shape of the `bots` convention field: a map from a bot's ship
// (a moon of the publisher) to its display profile.
export type BotProfilesField = Record<
  string,
  { nickname?: string | null; avatar?: string | null }
>;

export interface ContactBookProfileEdit {
  nickname?: ContactFieldText | null;
  bio?: ContactFieldText | null;
  avatar?: ContactImageField | null;
  cover?: ContactImageField | null;
  color?: ContactFieldColor | null;
  groups?: ContactFieldGroups | null;
  status?: ContactFieldText | null;
}

// first element is the contact's profile, second is any user overrides
export type ContactBookEntry = [ContactBookProfile, ContactBookProfile | null];

export type ContactsAllScryResult1 = Record<string, ContactBookProfile>;
export type ContactBookScryResult1 = Record<string, ContactBookEntry>;

// /v1/directory: unified view of all known peers + contacts (and our own
// profile). `contact` is the peer's self-published profile, `mod` the user's
// local overlay, `isContact` whether it's an explicit contact.
export interface ContactDirectoryEntry {
  isContact: boolean;
  contact: ContactBookProfile;
  mod: ContactBookProfile;
}
export type ContactDirectoryScryResult = Record<string, ContactDirectoryEntry>;

export type ContactsSelfResponse1 = {
  self: ContactBookProfile;
};

// received when someone is marked as a contact or when a contact's profile is updated
export type ContactsPageResponse1 = {
  page: {
    kip: string;
    contact: ContactBookProfile;
    mod: ContactBookProfile;
  };
};

export type ContactsWipeResponse1 = {
  wipe: {
    kip: string;
  };
};

// received when we get non-contact initial info
export type ContactsPeerResponse1 = {
  peer: {
    who: string;
    contact: ContactBookProfile;
  };
};

export type ContactsNewsResponse1 =
  | ContactsSelfResponse1
  | ContactsPageResponse1
  | ContactsWipeResponse1
  | ContactsPeerResponse1;

export function isPageResponse(
  response: ContactsNewsResponse1
): response is ContactsPageResponse1 {
  return 'page' in response;
}

export function isWipeResponse(
  response: ContactsNewsResponse1
): response is ContactsWipeResponse1 {
  return 'wipe' in response;
}

export function isPeerResponse(
  response: ContactsNewsResponse1
): response is ContactsPeerResponse1 {
  return 'peer' in response;
}

export function isSelfResponse(
  response: ContactsNewsResponse1
): response is ContactsSelfResponse1 {
  return 'self' in response;
}
