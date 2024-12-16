import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { AnalyticsEvent, normalizeUrbitColor } from '../logic';
import * as ub from '../urbit';
import { NormalizedTrack } from './musicApi';
import { getCurrentUserId, poke, scry, subscribe } from './urbit';

const logger = createDevLogger('contactsApi', true);

export const getSelf = async () => {
  const currentUserId = getCurrentUserId();
  const response = await scry<ub.ContactBookProfile>({
    app: 'contacts',
    path: '/v1/self',
  });

  return v1PeerToClientProfile(currentUserId, response);
};

export const getContacts = async () => {
  const currentUserId = getCurrentUserId();
  // this is all peers we know about, with merged profile data for
  // contacts
  const peersResponse = await scry<ub.ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });

  // this is all of your contacts, with unmerged profile data + user overrides
  const contactsResponse = await scry<ub.ContactBookScryResult1>({
    app: 'contacts',
    path: '/v1/book',
  });
  const skipContacts = new Set([
    ...Object.keys(contactsResponse),
    currentUserId,
  ]);

  const suggestionsResponse = await scry<string[]>({
    app: 'groups-ui',
    path: '/suggested-contacts',
  });

  const contactSuggestions = new Set(suggestionsResponse);

  const peerProfiles = v0PeersToClientProfiles(peersResponse, {
    userIdsToOmit: skipContacts,
    contactSuggestions,
  });
  const contactProfiles = contactsToClientProfiles(contactsResponse, {
    userIdsToOmit: new Set([currentUserId]),
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

  if (Object.keys(contactUpdate).length !== 0) {
    logger.trackEvent(AnalyticsEvent.ContactEdited);
  }

  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { edit: { kip: contactId, contact: contactUpdate } },
  });
};

export const updateSelfContactMetadata = async (metadata: ProfileUpdate) => {
  console.log(`updateSelfContactMetadata`, metadata);
  const contactUpdate: ub.ContactBookProfileEdit = {};

  if (metadata.status !== undefined) {
    contactUpdate.status = metadata.status
      ? { type: 'text', value: metadata.status }
      : null;
  }

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

  if (metadata.bio !== undefined) {
    contactUpdate.bio = metadata.bio
      ? { type: 'text', value: metadata.bio }
      : null;
  }

  if (metadata.coverImage !== undefined) {
    contactUpdate.cover = metadata.coverImage
      ? { type: 'look', value: metadata.coverImage }
      : null;
  }

  if (metadata.location !== undefined) {
    contactUpdate.location = metadata.location
      ? { type: 'text', value: JSON.stringify(metadata.location) }
      : null;
  }

  if (metadata.links !== undefined) {
    contactUpdate.links = metadata.links
      ? {
          type: 'set',
          value: metadata.links.map((link) => ({
            type: 'text',
            value: JSON.stringify(link),
          })),
        }
      : null;
  }

  console.log(`filing self poke`, { self: contactUpdate });

  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { self: contactUpdate },
  });
};

export const addContact = async (contactId: string) => {
  removeContactSuggestion(contactId);
  logger.trackEvent(AnalyticsEvent.ContactAdded);
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
  location?: domain.ProfileLocation | null;
  links?: domain.ProfileLink[] | null;
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

export const setPinnedTunes = async (tunes: NormalizedTrack[]) => {
  const contactUpdate: ub.ContactBookProfileEdit = {};
  contactUpdate.tunes = {
    type: 'set',
    value: tunes.map((tune) => ({ type: 'text', value: JSON.stringify(tune) })),
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
        return handler({
          type: 'upsertContact',
          contact: contactToClientProfile(kip, contactBookEntry),
        });
      }

      if (ub.isWipeResponse(event) && event.wipe.kip.startsWith('~')) {
        return handler({ type: 'removeContact', contactId: event.wipe.kip });
      }

      // received when we get initial or updated profile info for a non-contact. Note: we also get
      // a dupe event here if a contact updates their own profile (get a page fact and peer fact)
      if (ub.isPeerResponse(event) && event.peer.who.startsWith('~')) {
        const { who, contact } = event.peer;
        return handler({
          type: 'upsertContact',
          contact: v1PeerToClientProfile(who, contact),
        });
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

    isContact: false,
    isContactSuggestion: config?.isContactSuggestion && id !== currentUserId,
  };
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
  const tunes = parsePinnedTunes(contact);
  const location = parseLocation(contact);
  const links = parseLinks(contact);

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
    tunes,
    location,
    links,
    isContact: config?.isContact,
    isContactSuggestion:
      config?.isContactSuggestion && !config?.isContact && id !== currentUserId,
  };
};

export const contactsToClientProfiles = (
  contacts: ub.ContactBookScryResult1,
  config?: {
    userIdsToOmit?: Set<string>;
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  return Object.entries(contacts)
    .filter(([ship]) =>
      config?.userIdsToOmit ? !config.userIdsToOmit.has(ship) : true
    )
    .flatMap(([userId, contact]) =>
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
  const tunes = parsePinnedTunes(base);
  const location = parseLocation(base);
  const links = parseLinks(base);

  return {
    id: userId,
    peerNickname: base.nickname?.value ?? null,
    customNickname: overrides.nickname?.value,
    peerAvatarImage: base.avatar?.value ?? null,
    customAvatarImage: overrides.avatar?.value,
    status: base.status?.value ?? null,
    bio: base.bio?.value ?? null,
    coverImage: base.cover?.value ?? null,
    color: base.color ? normalizeUrbitColor(base.color.value) : null,
    pinnedGroups:
      base.groups?.value.map((group) => ({
        groupId: group.value,
        contactId: userId,
      })) ?? [],
    tunes,
    location,
    links,
    isContact: true,
    isContactSuggestion: false,
  };
};

export const parsePinnedTunes = (
  contact: ub.ContactBookProfile
): domain.NormalizedTrack[] => {
  if (!contact || !contact.tunes) {
    return [];
  }

  return contact.tunes.value.map(
    (tune) => JSON.parse(tune.value) as NormalizedTrack
  );
};

export const parseLocation = (
  contact: ub.ContactBookProfile
): domain.ProfileLocation | null => {
  if (!contact || !contact.location) {
    return null;
  }

  try {
    return JSON.parse(contact.location.value);
  } catch (e) {
    return null;
  }
};

export const parseLinks = (
  contact: ub.ContactBookProfile
): domain.ProfileLink[] | null => {
  if (!contact || !contact.links) {
    return null;
  }

  try {
    return contact.links.value.map((link) =>
      JSON.parse(link.value)
    ) as domain.ProfileLink[];
  } catch (e) {
    return null;
  }
};
