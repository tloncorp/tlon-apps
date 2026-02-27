import * as channel from './channel';
import * as content from './content';
import * as dms from './dms';
import * as groups from './groups';

export { channel, content, dms, groups };

// Explicit aliases for overlapping domain types.
export type ShipId = channel.ChannelShipId;
export type ShipMentionInline = content.ShipMention;
export type PatpLike = channel.ChannelPatda;
export type ChannelWrit = channel.Writ;
export type DmWrit = dms.DmWrit;
export type ChannelWritSeal = channel.WritSeal;
export type DmWritSeal = dms.DmWritSeal;
export type ChannelWritEssay = channel.WritEssay;
export type DmWritEssay = dms.DmWritEssay;
export type ChannelMap = channel.ChannelMap;
export type GroupChannelMap = groups.GroupChannelMap;

// Legacy compatibility exports for older callsites.
/** @deprecated Use ShipId or ShipMentionInline. */
export type Ship = channel.Ship;
/** @deprecated Use PatpLike. */
export type Patda = channel.Patda;
/** @deprecated Use ShipMentionInline. */
export type InlineShip = ShipMentionInline;
/** @deprecated Use ChannelWritSeal or DmWritSeal. */
export type WritSeal = channel.WritSeal | dms.WritSeal;
/** @deprecated Use ChannelWritEssay or DmWritEssay. */
export type WritEssay = channel.WritEssay | dms.WritEssay;
/** @deprecated Use ChannelWrit or DmWrit. */
export type Writ = channel.Writ | dms.Writ;
/** @deprecated Use ChannelMap. */
export type Channels = channel.Channels;
/** @deprecated Use GroupChannelMap. */
export type GroupChannels = groups.Channels;

export * from './activity';
export * from './channel';
export * from './contact';
export * from './dms';
export * from './groups';
export * from './content';
export * from './hark';
export * from './negotiation';
export * from './sigil';
export * from './ui';
export * from './volume';
export * from './utils';
export * from './settings';
export * from './storage';
export * from './vitals';
export * from './lanyard';
export * from './metagrab';
export * from './meta';
