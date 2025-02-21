import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';

export interface ReactionDetails {
  self: {
    didReact: boolean;
    value: string;
  };
  aggregate: Record<string, { value: string; count: number; users: string[] }>;
  list: { value: string; count: number; users: string[] }[];
}
export function useReactionDetails(
  reactions: db.Reaction[],
  ourId: string
): ReactionDetails {
  return useMemo(() => {
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
        details.aggregate[reaction.value].users.push(reaction.contactId);
      } else {
        details.aggregate[reaction.value] = {
          value: reaction.value,
          count: 1,
          users: [reaction.contactId],
        };
      }
      if (reaction.contactId === ourId) {
        details.self.didReact = true;
        details.self.value = reaction.value;
      }
      details.list = Object.values(details.aggregate);
    });

    return details;
  }, [reactions, ourId]);
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
