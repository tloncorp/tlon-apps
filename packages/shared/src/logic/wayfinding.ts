import * as db from '../db';
import { PersonalGroupNames, PersonalGroupSlugs } from '../domain';
import { getChannelKindFromType } from '../urbit';

export function getPersonalGroupKeys(currentUserId: string) {
  return {
    slug: PersonalGroupSlugs.slug,
    groupName: PersonalGroupNames.groupTitle,
    groupId: `${currentUserId}/${PersonalGroupSlugs.slug}`,

    chatSlug: PersonalGroupSlugs.chatSlug,
    chatChannelName: PersonalGroupNames.chatTitle,
    chatChannelId: `${getChannelKindFromType('chat')}/${currentUserId}/${PersonalGroupSlugs.chatSlug}`,

    collectionSlug: PersonalGroupSlugs.collectionSlug,
    collectionChannelName: PersonalGroupNames.collectionTitle,
    collectionChannelId: `${getChannelKindFromType('gallery')}/${currentUserId}/${PersonalGroupSlugs.collectionSlug}`,

    notebookSlug: PersonalGroupSlugs.notebookSlug,
    notebookChannelName: PersonalGroupNames.notebookTitle,
    notebookChannelId: `${getChannelKindFromType('notebook')}/${currentUserId}/${PersonalGroupSlugs.notebookSlug}`,
  };
}

export function getRandomDefaultPersonalGroupIcon() {
  const randomInteger = Math.floor(Math.random() * 5) + 1; // 1-5 inclusive
  return `https://storage.googleapis.com/tlon-messenger-public-assets/wayfindingGroupIcons/default${randomInteger}.png`;
}

export function personalGroupIsValid({
  group,
  currentUserId,
}: {
  group?: db.Group | null;
  currentUserId: string;
}): boolean {
  const PersonalGroupKeys = getPersonalGroupKeys(currentUserId);
  if (!group) {
    return false;
  }

  const chatChannel = group.channels?.find(
    (chan) => chan.id === PersonalGroupKeys.chatChannelId
  );
  const collectionChannel = group?.channels?.find(
    (chan) => chan.id === PersonalGroupKeys.collectionChannelId
  );
  const notesChannel = group?.channels?.find(
    (chan) => chan.id === PersonalGroupKeys.notebookChannelId
  );

  return Boolean(chatChannel && collectionChannel && notesChannel);
}

export function isDefaultPersonalChannel(
  channel: db.Channel,
  currentUserId: string
): boolean {
  const PersonalGroupKeys = getPersonalGroupKeys(currentUserId);
  return (
    channel.id === PersonalGroupKeys.chatChannelId ||
    channel.id === PersonalGroupKeys.collectionChannelId ||
    channel.id === PersonalGroupKeys.notebookChannelId
  );
}

export function isPersonalGroup(
  group: db.Group | undefined | null,
  currentUserId: string
): boolean {
  const PersonalGroupKeys = getPersonalGroupKeys(currentUserId);

  if (!group) {
    return false;
  }

  return group.id === PersonalGroupKeys.groupId;
}

export function isPersonalChatChannel(channelId: string): boolean {
  return channelId.includes(PersonalGroupSlugs.chatSlug);
}

export function isPersonalCollectionChannel(channelId: string): boolean {
  return channelId.includes(PersonalGroupSlugs.collectionSlug);
}

export function isPersonalNotebookChannel(channelId: string): boolean {
  return channelId.includes(PersonalGroupSlugs.notebookSlug);
}

export function detectWebSignup() {
  // Hosting sets this query param when redirectin to the web app
  // after desktop signup
  const url = new URL(window.location.href);
  const didSignup = url.searchParams.get('did-signup');
  return didSignup === 'true';
}

export function personalGroupHasDefaultTitle(group?: db.Group | null) {
  if (!group) {
    return false;
  }

  return group.title?.toLowerCase().includes('group');
}

export function generatePersonalGroupTitle(contact: {
  id: string;
  nickname?: string | null;
}) {
  const displayName = contact.nickname || contact.id;
  return `${displayName}'s Group`;
}
