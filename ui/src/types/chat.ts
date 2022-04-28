import {BigIntOrderedMap} from "@urbit/api";

export type Patda = string;
export type Ship = string;

export interface ChatSeal {
  time: Patda;
  feels: {
    [ship: Ship]: string;
  };
}

export interface ChatMemo {
  replying: Patda | null;
  author: Ship;
  sent: number;
  content: string;
}

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

export type ChatWrits = {
  time: Patda;
  writ: ChatWrit;
}[];

interface ChatDiffAdd {
  add: ChatMemo;
}

interface ChatDiffDel {
  del: string;
}

interface ChatDiffAddFeel {
  'add-feel': {
    time: string;
    feel: string;
    ship: string;
  };
}

interface ChatDiffAddSects {
  'add-sects': string[];
}

export type ChatDiff =
  | ChatDiffAdd
  | ChatDiffDel
  | ChatDiffAddFeel
  | ChatDiffAddSects;

export interface ChatUpdate {
  time: Patda;
  diff: ChatDiff;
}
export interface ChatPerm {
  writers: string[];
}

export interface Chat {
  writs: BigIntOrderedMap<ChatWrit>;
  perms: ChatPerm;
}
