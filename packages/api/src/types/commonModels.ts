export type ChannelType = 'chat' | 'notebook' | 'gallery' | 'dm' | 'groupDm';
export type PostDeliveryStatus =
  | 'enqueued'
  | 'pending'
  | 'sent'
  | 'failed'
  | 'needs_verification';
export type PinType = 'group' | 'channel' | 'dm' | 'groupDm';
export type GroupPrivacy = 'public' | 'private' | 'secret';
export type GroupJoinStatus = 'joining' | 'errored';
export type ActivityBucket = 'all' | 'mentions' | 'replies';
export type AttestationType = 'phone' | 'node' | 'twitter' | 'dummy';
export type AttestationDiscoverability = 'public' | 'verified' | 'hidden';
export type AttestationStatus = 'waiting' | 'pending' | 'verified';
export type PostType = 'block' | 'chat' | 'notice' | 'note' | 'reply' | 'delete';
