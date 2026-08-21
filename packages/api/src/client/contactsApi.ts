import { p, render } from '@urbit/aura';

import { createDevLogger } from '../lib/logger';
import { AnalyticsEvent } from '../types/analytics';
import type * as db from '../types/models';
import * as ub from '../urbit';
import { parseAttestationId } from './lanyardApi';
import * as NounParsers from './nounParsers';
import { getCurrentUserId, poke, scry, subscribe } from './urbit';
import { normalizeUrbitColor } from './utils';

const logger = createDevLogger('contactsApi', false);

export const getContacts = async () => {
  // /v1/directory is the unified v1 view of every known peer + contact (and our
  // own profile), with full profiles incl. custom fields and an isContact flag.
  // It supersedes the old v0 /all + /v1/book assembly.
  const directoryResponse = await scry<ub.ContactDirectoryScryResult>({
    app: 'contacts',
    path: '/v1/directory',
  });

  const suggestionsResponse = await scry<string[]>({
    app: 'groups-ui',
    path: '/suggested-contacts',
  });

  return directoryToClientProfiles(directoryResponse, {
    contactSuggestions: new Set(suggestionsResponse),
  });
};

// True when `who` is a moon sponsored by `publisher`. A moon's sponsor is fixed
// and derivable from its @p, so this needs no network state -- it lets us trust
// a bot profile only when published by the bot-moon's actual parent.
const isMoonOf = (who: string, publisher: string): boolean => {
  try {
    return p.clan(who) === 'earl' && p.sein(who) === publisher;
  } catch {
    return false;
  }
};

// Read the `bots` convention field on a ship's published profile: the list of
// bot ships (moons of the publisher) it claims to own. This is only the
// ownership claim — a bot's display profile (name/avatar) is resolved from the
// bot's own real contact profile, which the host publishes separately. The
// field is a native contact %set of %ship values; decode it defensively.
const readBotsField = (
  profile: ub.ContactBookProfile | null | undefined
): ub.BotClaimField => {
  const raw = profile?.bots?.value;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry) =>
    entry?.type === 'ship' && typeof entry.value === 'string'
      ? [entry.value]
      : []
  );
};

const normalizeMoonId = (id: string): string =>
  id.startsWith('~') ? id : `~${id}`;

/**
 * True when `ship` is a bot moon registered in its sponsor's published
 * profile (the `bots` convention field). This is the client-side signal to
 * route DMs through the vouched path — a real, running moon that isn't
 * registered as a bot gets normal peer-to-peer DMs.
 */
export const isRegisteredBot = async (ship: string): Promise<boolean> => {
  try {
    if (p.clan(ship) !== 'earl') {
      return false;
    }
    const host = p.sein(ship);
    const directory = await scry<ub.ContactDirectoryScryResult>({
      app: 'contacts',
      path: '/v1/directory',
    });
    const entry = directory?.[host];
    if (!entry) {
      return false;
    }
    const bots = readBotsField(entry.contact);
    // Honor the claim only when `ship` really is a moon of `host`, so a ship
    // can't route another ship's DMs through the vouched path by claiming it.
    return (
      isMoonOf(ship, host) && bots.some((id) => normalizeMoonId(id) === ship)
    );
  } catch {
    return false;
  }
};

/** Editable fields of a bot moon's published profile. `undefined` keeps the
 * current value; `null` (or empty string) clears the field. */
export interface BotProfileEdit {
  nickname?: string | null;
  avatar?: string | null;
  bio?: string | null;
  status?: string | null;
  cover?: string | null;
}

const BOT_PROFILE_FIELD_TYPES: Record<
  keyof BotProfileEdit,
  ub.ContactFieldText['type'] | ub.ContactImageField['type']
> = {
  nickname: 'text',
  bio: 'text',
  status: 'text',
  avatar: 'look',
  cover: 'look',
};

/**
 * Register or update a bot moon owned by the current (host) ship. Two writes:
 *   1. Claim: add the moon to the host's `bots` convention field (a list of
 *      @p) so peers know it's a bot this host owns.
 *   2. Profile: publish the bot's real contact profile via the
 *      `contact-bot-0` poke, so it renders like any peer without ever running.
 * The contact-bot-0 poke REPLACES the bot's whole profile, so this reads the
 * current one and merges: `undefined` fields keep their current value,
 * `null`/empty clears them. Sibling bots in the claim are preserved. Must be
 * poked by the moon's host (the moon's sponsor).
 */
export const registerBotProfile = async (
  moon: string,
  profile: BotProfileEdit
) => {
  const botId = normalizeMoonId(moon);
  const self = await scry<ub.ContactBookProfile>({
    app: 'contacts',
    path: '/v1/self',
  });
  const claim = readBotsField(self);
  if (!claim.some((id) => normalizeMoonId(id) === botId)) {
    claim.push(botId);
    await poke({
      app: 'contacts',
      mark: 'contact-action-1',
      json: {
        self: {
          bots: {
            type: 'set',
            value: claim.map((id) => ({ type: 'ship', value: id })),
          },
        },
      },
    });
  }
  // start from the bot's currently published profile so a partial update
  // (or a runner restart re-registering from static config) doesn't wipe
  // fields set elsewhere
  const con: Record<string, ub.ContactFieldText | ub.ContactImageField> = {};
  try {
    const directory = await scry<ub.ContactDirectoryScryResult>({
      app: 'contacts',
      path: '/v1/directory',
    });
    const existing = directory?.[botId]?.contact ?? {};
    for (const [key, value] of Object.entries(existing)) {
      const type = (value as { type?: string } | null)?.type;
      if (type === 'text' || type === 'look') {
        con[key] = value as ub.ContactFieldText | ub.ContactImageField;
      }
    }
  } catch {
    // no directory yet (or scry failed): merge onto an empty profile
  }
  for (const key of Object.keys(
    BOT_PROFILE_FIELD_TYPES
  ) as (keyof BotProfileEdit)[]) {
    const value = profile[key];
    if (value === undefined) {
      continue;
    }
    if (value === null || value === '') {
      delete con[key];
      continue;
    }
    con[key] = { type: BOT_PROFILE_FIELD_TYPES[key], value } as
      | ub.ContactFieldText
      | ub.ContactImageField;
  }
  return poke({
    app: 'contacts',
    mark: 'contact-bot-0',
    json: { who: botId, con },
  });
};

export const directoryToClientProfiles = (
  directory: ub.ContactDirectoryScryResult,
  config?: {
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  const currentUserId = getCurrentUserId();
  return Object.entries(directory).flatMap(([id, entry]) => {
    const hasOverlay = !!entry.mod && Object.keys(entry.mod).length > 0;
    const profile = contactToClientProfile(id, [
      entry.contact,
      hasOverlay ? entry.mod : null,
    ]);
    // /v1/directory carries an explicit isContact flag; an empty overlay must
    // not be mistaken for "is a contact" (as contactToClientProfile assumes).
    profile.isContact = entry.isContact;
    profile.isContactSuggestion =
      !!config?.contactSuggestions?.has(id) &&
      !entry.isContact &&
      id !== currentUserId;
    return [profile];
  });
};

export const toContactsData = ({
  peersResponse,
  contactsResponse,
  suggestionsResponse,
}: {
  peersResponse: ub.ContactRolodex;
  contactsResponse: ub.ContactBookScryResult1;
  suggestionsResponse: string[];
}) => {
  const skipContacts = new Set(Object.keys(contactsResponse));
  const contactSuggestions = new Set(suggestionsResponse);

  const peerProfiles = v0PeersToClientProfiles(peersResponse, {
    userIdsToOmit: skipContacts,
    contactSuggestions,
  });
  const contactProfiles = contactsToClientProfiles(contactsResponse, {
    contactSuggestions,
  });

  return [...peerProfiles, ...contactProfiles];
};

export const removeContactSuggestion = async (contactId: string) => {
  return poke({
    app: 'groups-ui',
    mark: 'ui-hide-contact',
    json: contactId,
  });
};

export const addContactSuggestions = async (contactIds: string[]) => {
  return poke({
    app: 'groups-ui',
    mark: 'ui-add-contact-suggestions',
    json: contactIds,
  });
};

export const syncUserProfiles = async (userIds: string[]) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { meet: userIds },
  });
};

export const updateContactMetadata = async (
  contactId: string,
  metadata: { nickname?: string; avatarImage?: string }
) => {
  const contactUpdate: ub.ContactBookProfileEdit = {};
  if (metadata.nickname !== undefined) {
    contactUpdate.nickname = metadata.nickname
      ? { type: 'text', value: metadata.nickname }
      : null;
  }

  if (metadata.avatarImage !== undefined) {
    contactUpdate.avatar = metadata.avatarImage
      ? { type: 'look', value: metadata.avatarImage }
      : null;
  }

  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { edit: { kip: contactId, contact: contactUpdate } },
  });
};

export const addContact = async (contactId: string) => {
  removeContactSuggestion(contactId);
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: {
      page: { kip: contactId, contact: {} },
    },
  });
};

// TODO: once we can add in bulk from the backend, do so
export const addUserContacts = async (contactIds: string[]) => {
  const promises = contactIds.map((contactId) => {
    return addContact(contactId);
  });
  return Promise.all(promises);
};

export const removeContact = async (contactId: string) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { wipe: [contactId] },
  });
};

export interface ProfileUpdate {
  nickname?: string | null;
  status?: string;
  bio?: string;
  avatarImage?: string | null;
  coverImage?: string;
}
export const updateCurrentUserProfile = async (update: ProfileUpdate) => {
  const editedFields: ub.ContactEditField[] = [];
  if (update.nickname !== undefined) {
    editedFields.push({ nickname: update.nickname ?? '' });
  }

  if (update.status !== undefined) {
    editedFields.push({ status: update.status });
  }

  if (update.bio !== undefined) {
    editedFields.push({ bio: update.bio });
  }

  if (update.avatarImage !== undefined) {
    editedFields.push({ avatar: update.avatarImage ?? '' });
  }

  if (update.coverImage !== undefined) {
    editedFields.push({ cover: update.coverImage });
  }

  const action: ub.ContactEdit = {
    edit: editedFields,
  };

  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: action,
  });
};

export const updateSigilColor = async (color: string | null) => {
  const contactUpdate: ub.ContactBookProfileEdit = {};
  if (color) {
    let urbitColor = color.startsWith('#') ? color.slice(1) : color;
    if (urbitColor.startsWith('0x')) {
      urbitColor = urbitColor.slice(2);
    }
    //NOTE  'tint' parser wants @ux without the leading 0x...
    const formattedColor = render('ux', BigInt('0x' + urbitColor)).slice(2);
    contactUpdate.color = {
      type: 'tint',
      value: formattedColor,
    };
  } else {
    contactUpdate.color = {
      type: 'tint',
      value: '0',
    };
  }

  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { self: contactUpdate },
  });
};

export const addPinnedGroup = async (groupId: string) => {
  const update: ub.ContactEdit = { edit: [{ 'add-group': groupId }] };
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: update,
  });
};

export const removePinnedGroup = async (groupId: string) => {
  const update: ub.ContactEdit = { edit: [{ 'del-group': groupId }] };
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: update,
  });
};

export const setPinnedGroups = async (groupIds: string[]) => {
  const contactUpdate: ub.ContactBookProfileEdit = {};
  contactUpdate.groups = {
    type: 'set',
    value: groupIds.map((groupId) => ({ type: 'flag', value: groupId })),
  };

  console.log(`contact-action-1`, { self: { contact: contactUpdate } });

  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { self: contactUpdate },
  });
};

export type ContactsUpdate =
  | { type: 'upsertContact'; contact: db.Contact }
  | { type: 'removeContact'; contactId: string };

export const subscribeToContactUpdates = (
  handler: (update: ContactsUpdate) => void
) => {
  subscribe(
    {
      app: 'contacts',
      path: '/v1/news',
    },
    (event: ub.ContactsNewsResponse1) => {
      // received when someone is marked as a contact or when a contact's profile is updated
      if (ub.isPageResponse(event) && event.page.kip.startsWith('~')) {
        const { kip, contact, mod } = event.page;
        const contactBookEntry = [contact, mod] as ub.ContactBookEntry;
        handler({
          type: 'upsertContact',
          contact: contactToClientProfile(kip, contactBookEntry),
        });
        return;
      }

      if (ub.isWipeResponse(event) && event.wipe.kip.startsWith('~')) {
        return handler({ type: 'removeContact', contactId: event.wipe.kip });
      }

      // received when we get initial or updated profile info for a non-contact. Note: we also get
      // a dupe event here if a contact updates their own profile (get a page fact and peer fact)
      if (ub.isPeerResponse(event) && event.peer.who.startsWith('~')) {
        const { who, contact } = event.peer;
        handler({
          type: 'upsertContact',
          contact: v1PeerToClientProfile(who, contact),
        });
        return;
      }
    }
  );
};

// Used for converting the legacy contacts format to client representation.
export const v0PeersToClientProfiles = (
  contacts: ub.ContactRolodex,
  config?: {
    userIdsToOmit?: Set<string>;
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  return Object.entries(contacts)
    .filter(([ship]) =>
      config?.userIdsToOmit ? !config.userIdsToOmit.has(ship) : true
    )
    .flatMap(([ship, contact]) =>
      contact === null
        ? []
        : [
            v0PeerToClientProfile(ship, contact, {
              isContactSuggestion: config?.contactSuggestions?.has(ship),
            }),
          ]
    );
};

export const v0PeerToClientProfile = (
  id: string,
  contact: ub.Contact | null,
  config?: {
    isContactSuggestion?: boolean;
  }
): db.Contact => {
  const currentUserId = getCurrentUserId();
  return {
    id,
    peerNickname: contact?.nickname ?? null,
    peerAvatarImage: contact?.avatar ?? null,
    bio: contact?.bio ?? null,
    status: contact?.status ?? null,
    color: contact?.color ? normalizeUrbitColor(contact.color) : null,
    coverImage: contact?.cover ?? null,
    pinnedGroups:
      contact?.groups?.map((groupId) => ({
        groupId,
        contactId: id,
      })) ?? [],

    attestations: parseContactAttestations(id, contact),
    isContact: false,
    isContactSuggestion: config?.isContactSuggestion && id !== currentUserId,
  };
};

function parseContactAttestations(
  contactId: string,
  contact?: ub.Contact | ub.ContactBookProfile | null
): db.ContactAttestation[] | null {
  if (!contact) {
    return null;
  }

  const attestations: db.Attestation[] = [];

  if (
    contact['lanyard-twitter-0-sign'] &&
    contact['lanyard-twitter-0-sign'].value
  ) {
    try {
      const sign = NounParsers.parseSigned(
        contact['lanyard-twitter-0-sign'].value
      );

      // TODO: check contactId matches signed data

      if (sign) {
        const signIsGenuine = sign.contactId === contactId;
        if (signIsGenuine) {
          const providerUrl = contact['lanyard-twitter-0-url']?.value ?? null;
          const provider = '~zod'; // TODO: can we get this info?
          const type = sign.type;
          const value = sign.signType === 'full' ? sign.value : '';
          const id = parseAttestationId({ provider, type, value, contactId });
          const provingTweetId =
            sign.signType === 'full' ? sign.proofTweetId ?? null : null;

          attestations.push({
            id,
            provider,
            type,
            value,
            contactId,
            initiatedAt: sign.when,
            discoverability: sign.signType === 'full' ? 'public' : 'verified',
            status: 'verified',
            providerUrl,
            provingTweetId,
            signature: sign.signature,
          });
        } else {
          logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
            context: 'forged attestation',
            type: 'twitter',
            contactId,
            sign: contact['lanyard-twitter-0-sign']?.value,
          });
        }
      }
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNounParse, {
        parser: 'twitter signed',
        error: e,
        errorMessage: e.message,
        noun: contact['lanyard-twitter-0-sign'].value,
      });
    }
  }

  if (
    contact['lanyard-phone-0-sign'] &&
    contact['lanyard-phone-0-sign'].value
  ) {
    try {
      const sign = NounParsers.parseSigned(
        contact['lanyard-phone-0-sign'].value
      );

      if (sign) {
        const signIsGenuine = sign.contactId === contactId;
        if (signIsGenuine) {
          const providerUrl = contact['lanyard-phone-0-url']?.value ?? null;
          const provider = '~zod'; // TODO: can we get this info?
          const type = sign.type;
          const value = sign.signType === 'full' ? sign.value : '';
          const id = parseAttestationId({ provider, type, value, contactId });
          const provingTweetId =
            sign.signType === 'full' ? sign.proofTweetId ?? null : null;

          if (sign.contactId !== contactId) {
            logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
              context: 'forged attestation',
              contactId,
              sign: contact['lanyard-phone-0-sign']?.value,
            });
          }

          attestations.push({
            id,
            provider,
            type,
            value,
            contactId,
            initiatedAt: sign.when,
            discoverability: sign.signType === 'full' ? 'public' : 'verified',
            status: 'verified',
            providerUrl,
            provingTweetId,
            signature: sign.signature,
          });
        } else {
          logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
            context: 'forged attestation',
            type: 'phone',
            contactId,
            sign: contact['lanyard-phone-0-sign']?.value,
          });
        }
      }
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorNounParse, {
        parser: 'phone signed',
        error: e,
        errorMessage: e.message,
        noun: contact['lanyard-phone-0-sign'].value,
      });
    }
  }

  if (attestations.length === 0) {
    return null;
  }

  const finalAttests = attestations.map((a) => ({
    contactId,
    attestationId: a.id,
    attestation: a,
  }));

  return finalAttests;
}

export const v1PeersToClientProfiles = (
  peers: ub.ContactsAllScryResult1,
  config?: {
    contactSuggestions?: Set<string>;
  }
) => {
  return Object.entries(peers).map(([ship, contact]) =>
    v1PeerToClientProfile(ship, contact, {
      isContactSuggestion: config?.contactSuggestions?.has(ship),
    })
  );
};

export const v1PeerToClientProfile = (
  id: string,
  contact: ub.ContactBookProfile,
  config?: {
    isContact?: boolean;
    isContactSuggestion?: boolean;
  }
): db.Contact => {
  const currentUserId = getCurrentUserId();
  return {
    id,
    peerNickname: contact.nickname?.value ?? null,
    peerAvatarImage: contact.avatar?.value ?? null,
    bio: contact.bio?.value ?? null,
    status: contact.status?.value ?? null,
    color: contact.color ? normalizeUrbitColor(contact.color.value) : null,
    coverImage: contact.cover?.value ?? null,
    pinnedGroups:
      contact.groups?.value.map((group) => ({
        groupId: group.value,
        contactId: id,
      })) ?? [],
    attestations: parseContactAttestations(id, contact),
    isContact: config?.isContact,
    isContactSuggestion:
      config?.isContactSuggestion && !config?.isContact && id !== currentUserId,
  };
};

export const contactsToClientProfiles = (
  contacts: ub.ContactBookScryResult1,
  config?: {
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  return Object.entries(contacts).flatMap(([userId, contact]) =>
    contact === null
      ? []
      : [
          contactToClientProfile(userId, contact, {
            isContactSuggestion: config?.contactSuggestions?.has(userId),
          }),
        ]
  );
};

export const contactToClientProfile = (
  userId: string,
  contact: ub.ContactBookEntry,
  config?: {
    isContactSuggestion?: boolean;
  }
): db.Contact => {
  const [base, overrides] = contact;

  return {
    id: userId,
    peerNickname: base.nickname?.value ?? null,
    customNickname: overrides?.nickname?.value,
    peerAvatarImage: base.avatar?.value ?? null,
    customAvatarImage: overrides?.avatar?.value,
    status: base.status?.value ?? null,
    bio: base.bio?.value ?? null,
    coverImage: base.cover?.value ?? null,
    color: base.color ? normalizeUrbitColor(base.color.value) : null,
    pinnedGroups:
      base.groups?.value.map((group) => ({
        groupId: group.value,
        contactId: userId,
      })) ?? [],
    attestations: parseContactAttestations(userId, base),
    isContact: !!overrides,
    isContactSuggestion: false,
  };
};
