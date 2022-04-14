
export type Patda = string;
export type Ship = string;

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

export interface ChatSeal {
  time: Patda;
}

export interface ChatWrit {
  seal: ChatSeal;
  memo: ChatMemo;
}

export interface ChatSeal {
  time: Patda;
  feel: {
    [name: string]: Ship[];
  }
}

export interface ChatMemo {
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


export type ChatDiff = ChatDiffAdd;
