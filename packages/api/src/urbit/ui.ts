import { Activity } from './activity';
import { ChannelHeadsResponse, Channels, Posts } from './channel';
import { ContactBookEntry } from './contact';
import { ChatHeadsResponse, DMInit2, Writs } from './dms';
import { BucketsSummary } from './buckets';
import { Foreigns, GroupV7, Groups, GroupsV7 } from './groups';

export interface GroupsInit7 {
  groups: Record<string, GroupV7>;
  foreigns: Foreigns;
  channel: {
    channels: Channels;
    'hidden-posts': string[];
  };
  activity: Activity;
  pins: string[];
  chat: DMInit2;
  /**
   * Buckets, from /v10 onward.
   *
   * They ride in init for the same reason channels do: their writer roles
   * live in their own agent rather than in %groups, so a client that learns
   * of a Bucket from the group alone cannot tell "no writers" from "not yet
   * known" -- and for a writer set those differ by everything.
   *
   * Optional because /v7 does not carry them.
   */
  buckets?: BucketsSummary[];
}

export type GroupsInit6 = GroupsInit7;

export interface CombinedHeads {
  dms: ChatHeadsResponse;
  channels: ChannelHeadsResponse;
}

export interface Changes {
  groups: Groups;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export interface ChangesV8 {
  groups: GroupsV7;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export type ChangesV7 = ChangesV8;

export interface PostsInit {
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
}
