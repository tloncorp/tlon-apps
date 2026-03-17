import EmojiData, { EmojiMartData } from '@emoji-mart/data';
import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

interface ReactionListItemUser {
  id: string;
  name: string;
}
export interface ReactionListItem {
  value: string;
  count: number;
  users: ReactionListItemUser[];
}
export interface ReactionDetails {
  self: {
    didReact: boolean;
    value: string;
  };
  aggregate: Record<string, ReactionListItem>;
  list: ReactionListItem[];
}

function resolveContactName(
  contact: db.Contact | null | undefined,
  contactId: string
): string {
  // Priority: customNickname (if not empty) -> peerNickname (if not empty) -> contactId
  if (contact?.customNickname && contact.customNickname.trim() !== '') {
    return contact.customNickname.trim();
  }
  if (contact?.peerNickname && contact.peerNickname.trim() !== '') {
    return contact.peerNickname.trim();
  }
  // Final fallback: ensure contactId is valid
  return contactId && contactId.trim() !== '' ? contactId : 'Unknown User';
}

function getReactionDisplayValue(value: string): string {
  const shortCode = value.replace(/^:|:$/g, '');
  return (
    (EmojiData as EmojiMartData).emojis[shortCode]?.skins[0].native ?? value
  );
}

export function computeReactionDetails(
  reactions: db.Reaction[],
  ourId: string
): ReactionDetails {
  const details = {
    self: {
      didReact: false,
      value: '',
    },
    aggregate: {},
    list: [],
  } as ReactionDetails;

  reactions.forEach((reaction) => {
    const reactionValue = getReactionDisplayValue(reaction.value);

    if (details.aggregate[reactionValue]) {
      details.aggregate[reactionValue].count++;
      details.aggregate[reactionValue].users.push({
        id: reaction.contactId,
        name: resolveContactName(reaction.contact, reaction.contactId),
      });
    } else {
      details.aggregate[reactionValue] = {
        value: reactionValue,
        count: 1,
        users: [
          {
            id: reaction.contactId,
            name: resolveContactName(reaction.contact, reaction.contactId),
          },
        ],
      };
    }
    if (reaction.contactId === ourId) {
      details.self.didReact = true;
      details.self.value = reactionValue;
    }
  });

  details.list = Object.values(details.aggregate);

  return details;
}

export function useReactionDetails(
  reactions: db.Reaction[],
  ourId: string
): ReactionDetails {
  return useMemo(
    () => computeReactionDetails(reactions, ourId),
    [reactions, ourId]
  );
}

export type GroupedReactions = Record<
  string,
  { value: string; userId: string }[]
>;

export function useGroupedReactions(
  reactions: db.Reaction[]
): GroupedReactions {
  return useMemo(() => {
    const groupedReactions: GroupedReactions = {};

    reactions.forEach((reaction) => {
      const reactionValue = getReactionDisplayValue(reaction.value);

      if (!groupedReactions[reactionValue]) {
        groupedReactions[reactionValue] = [];
      }
      groupedReactions[reactionValue].push({
        value: reactionValue,
        userId: reaction.contactId,
      });
    });

    return groupedReactions;
  }, [reactions]);
}
