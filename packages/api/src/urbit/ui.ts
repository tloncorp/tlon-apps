import { Activity } from './activity';
import { ChannelHeadsResponse, Channels, Posts } from './channel';
import { ContactBookEntry } from './contact';
import { ChatHeadsResponse, DMInit2, Writs } from './dms';
import { BucketsSummary } from './buckets';
import { Foreigns, GroupV11, Groups, GroupsV11 } from './groups';

export interface GroupsInit10 {
  groups: Record<string, GroupV11>;
  foreigns: Foreigns;
  channel: {
    channels: Channels;
    'hidden-posts': string[];
  };
  activity: Activity;
  pins: string[];
  chat: DMInit2;
}

/**
 * /v10 plus Buckets.
 *
 * They ride in init for the same reason channels do: their writer roles live
 * in their own agent rather than in %groups, so a client that learns of a
 * Bucket from the group alone cannot tell "no writers" from "not yet known"
 * — and for a writer set those differ by everything.
 */
export interface GroupsInit11 extends GroupsInit10 {
  buckets: BucketsSummary[];
}

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

export interface ChangesV11 {
  groups: GroupsV11;
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
  contacts: Record<string, ContactBookEntry>;
  activity: Activity;
}

export interface PostsInit {
  channels: Record<string, Posts | null>;
  chat: Record<string, Writs | null>;
}
