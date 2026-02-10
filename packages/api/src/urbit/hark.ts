export type Flag = string; // ~{ship}/{name}
export type Id = string; // @uvH

export type Thread = Id[];

export interface Threads {
  [time: string]: Thread; // time is @da
}

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

interface YarnContentShip {
  ship: string;
}

interface YarnContentEmphasis {
  emph: string;
}

export type YarnContent = string | YarnContentShip | YarnContentEmphasis;

export function isYarnShip(obj: YarnContent): obj is YarnContentShip {
  return typeof obj !== 'string' && 'ship' in obj;
}

export interface Rope {
  group: Flag | null;
  channel: Flag | null;
  desk: string;
  thread: string;
}

export type Seam = { group: Flag } | { desk: string } | { all: null };

export interface Yarns {
  [id: Id]: Yarn;
}

export interface Cable {
  rope: Rope;
  thread: Thread;
}

export interface Carpet {
  seam: Seam;
  yarns: Yarns;
  cable: Cable[];
  stitch: number;
}

export interface Blanket {
  seam: Seam;
  yarns: Yarns;
  quilt: {
    [key: number]: Thread;
  };
}

export interface HarkAddYarn {
  'add-yarn': {
    all: boolean;
    desk: boolean;
    yarn: Yarn;
  };
}

export interface HarkSawSeam {
  'saw-seam': Seam;
}

export interface HarkSawRope {
  'saw-rope': Rope;
}

export type HarkAction = HarkAddYarn | HarkSawSeam | HarkSawRope;
export type HarkAction1 = HarkAddNewYarn | HarkAction;

export interface HarkUpdate {
  yarns: Yarns;
  seam: Seam;
  threads: Threads;
}

export interface NewYarn extends Omit<Yarn, 'id' | 'time'> {
  all: boolean;
  desk: boolean;
}

export interface HarkAddNewYarn {
  'new-yarn': NewYarn;
}

export interface Skein {
  time: number;
  count: number;
  shipCount: number;
  top: Yarn;
  unread: boolean;
}
