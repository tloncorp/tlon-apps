export type Patda = string;
export type Ship = string;

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

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

export type ChatWrits = {
  time: Patda;
  writ: ChatWrit;
}[];

export interface ChatUpdate {
  time: Patda;
  diff: ChatDiff;
}

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

export type ChatDiff = ChatDiffAdd | ChatDiffDel | ChatDiffAddFeel;
