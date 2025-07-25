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
    if (details.aggregate[reaction.value]) {
      details.aggregate[reaction.value].count++;
      details.aggregate[reaction.value].users.push({
        id: reaction.contactId,
        name: resolveContactName(reaction.contact, reaction.contactId),
      });
    } else {
      details.aggregate[reaction.value] = {
        value: reaction.value,
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
      details.self.value = reaction.value;
    }
    details.list = Object.values(details.aggregate);
  });

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
      if (!groupedReactions[reaction.value]) {
        groupedReactions[reaction.value] = [];
      }
      groupedReactions[reaction.value].push({
        value: reaction.value,
        userId: reaction.contactId,
      });
    });

    return groupedReactions;
  }, [reactions]);
}
