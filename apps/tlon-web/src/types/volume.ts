export type Level = 'soft' | 'loud' | 'hush';

// eslint-disable-next-line no-shadow
export enum LevelNames {
  soft = 'Only mentions and replies',
  loud = 'All messages',
  hush = 'Muted',
}

export type GroupScope = {
  ['group']: string;
};

export type ChannelScope = {
  ['channel']: string;
};

export type Scope = GroupScope | ChannelScope;

export type VolumeValue = Level | null;
