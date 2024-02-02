export type Level = 'soft' | 'loud' | 'hush';

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
