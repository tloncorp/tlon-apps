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
  // this is all peers and ship contacts we know about, with unmerged
  // profile data
  const directoryResponse = await scry<ub.ContactsDirectoryScryResult1>({
    app: 'contacts',
    path: '/v1/directory',
  });

  // this is all of your contacts, with unmerged profile data + user overrides
  const contactsResponse = await scry<ub.ContactBookScryResult1>({
    app: 'contacts',
    path: '/v1/book',
  });

  const suggestionsResponse = await scry<string[]>({
    app: 'groups-ui',
    path: '/suggested-contacts',
  });

  return toContactsData({
    directoryResponse: directoryResponse,
    contactsResponse: contactsResponse,
    suggestionsResponse: suggestionsResponse,
  });
};

// --- Virtual-identity (bot moon) helpers ---
//
// A virtual bot is a moon its sponsor hosts and answers for; distinct from
// the self-published `bot-info` field on real, running bot ships below.

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
  let host: string;
  try {
    if (p.clan(ship) !== 'earl') {
      return false;
    }
    host = p.sein(ship);
  } catch {
    // not a parseable ship id -- never a bot
    return false;
  }
  // NB: deliberately no catch around the scry. This read gates whether a DM
  // takes the vouched path, so a failed read must fail the send loudly
  // rather than silently demote a bot DM to peer-to-peer (which would queue
  // forever against a never-booted moon).
  const directory = await scry<ub.ContactsDirectoryScryResult1>({
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

const BOT_PROFILE_FIELDS: (keyof BotProfileEdit)[] = [
  'nickname',
  'avatar',
  'bio',
  'status',
  'cover',
];

/**
 * Register or update the profile of a bot moon owned by the current (host)
 * ship, via steward's roster `%profile` action. Steward is the arbiter of
 * bot data in contacts: it validates the moon against its roster, forwards
 * the edit to %contacts as a merge (`undefined` fields stay untouched,
 * `null`/empty deletes), and maintains the host's `bots` claim field itself
 * as a projection of its roster -- so there is nothing to read, merge, or
 * claim client-side. Must be poked as the host (the moon's sponsor).
 */
export const registerBotProfile = async (
  moon: string,
  profile: BotProfileEdit
) => {
  const edits: Record<string, string | null> = {};
  for (const key of BOT_PROFILE_FIELDS) {
    const value = profile[key];
    if (value === undefined) {
      continue;
    }
    edits[key] = value === '' ? null : value;
  }
  return poke({
    app: 'steward',
    mark: 'steward-roster-action-1',
    json: { profile: { ship: normalizeMoonId(moon), edits } },
  });
};

export const toContactsData = ({
  directoryResponse,
  contactsResponse,
  suggestionsResponse,
}: {
  directoryResponse: ub.ContactsDirectoryScryResult1;
  contactsResponse: ub.ContactBookScryResult1;
  suggestionsResponse: string[];
}) => {
  const skipContacts = new Set(Object.keys(contactsResponse));
  const contactSuggestions = new Set(suggestionsResponse);

  const peerProfiles = directoryToClientProfiles(directoryResponse, {
    userIdsToOmit: skipContacts,
    contactSuggestions,
  });
  const contactProfiles = contactsToClientProfiles(contactsResponse, {
    contactSuggestions,
  });

  return [...peerProfiles, ...contactProfiles];
};

export const directoryToClientProfiles = (
  directory: ub.ContactsDirectoryScryResult1,
  config?: {
    userIdsToOmit?: Set<string>;
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  return Object.entries(directory)
    .filter(
      ([ship, entry]) =>
        // a peer we know about but have no profile data for isn't a useful
        // profile row; their data arrives via /v1/news once it exists
        Object.keys(entry.contact).length > 0 &&
        (config?.userIdsToOmit ? !config.userIdsToOmit.has(ship) : true)
    )
    .map(([ship, entry]) =>
      v1PeerToClientProfile(ship, entry.contact, {
        isContact: false,
        isContactSuggestion: config?.contactSuggestions?.has(ship),
      })
    );
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

// Pure builder for a self-profile field poke: `%self` is a merge, so other
// keys survive, and a null value deletes the key (contact keys only die by
// explicit null). Exported shape-only — no transport — so callers with their
// own Urbit client (the OpenClaw plugin's shim, tests) share one source of
// truth for the wire format instead of hand-rolling the action JSON.
export const contactSelfFieldPoke = (
  key: string,
  value: Exclude<
    ub.ContactBookProfile[keyof ub.ContactBookProfile],
    undefined
  > | null
): { app: string; mark: string; json: unknown } => ({
  app: 'contacts',
  mark: 'contact-action-1',
  json: { self: { [key]: value } },
});

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

function parseContactAttestations(
  contactId: string,
  contact?: ub.ContactBookProfile | null
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
            sign.signType === 'full' ? (sign.proofTweetId ?? null) : null;

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
            sign.signType === 'full' ? (sign.proofTweetId ?? null) : null;

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

/**
 * The `bot-info` contact field is self-published by bot ships and its TS
 * declaration proves nothing at runtime — an arbitrary profile can publish it
 * as %set/%numb/%look or any JSON shape. Accept only a %text field carrying a
 * string; everything else maps to null so one bad peer profile cannot break a
 * contacts sync batch.
 */
export const extractBotInfoValue = (field: unknown): string | null => {
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return null;
  }
  const candidate = field as { type?: unknown; value?: unknown };
  if (candidate.type !== 'text' || typeof candidate.value !== 'string') {
    return null;
  }
  return candidate.value;
};

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
    botInfo: extractBotInfoValue(contact['bot-info']),
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
    // The claim is the bot's own published property: read it from the
    // peer-published base contact only, never the user's `mod` overlay.
    botInfo: extractBotInfoValue(base['bot-info']),
    isContact: !!overrides,
    isContactSuggestion: false,
  };
};
