export type Flag = string; // ~{ship}/{name}
export type Id = string; // @uvH

export interface Yarn {
  id: Id;
  rope: Rope;
  time: number;
  con: YarnContent[];
  wer: string;
  but: YarnButton | null;
}

export interface YarnButton {
  title: string;
  handler: string;
}

export interface YarnContentShip {
  ship: string;
}

export interface YarnContentEmphasis {
  emph: string;
}

export type YarnContent = string | YarnContentShip | YarnContentEmphasis;

export interface Rope {
  group: Flag | null;
  channel: Flag | null;
  desk: string;
  thread: string;
}

export interface HarkSawRope {
  'saw-rope': Rope;
}

export type HarkAction = HarkSawRope;
