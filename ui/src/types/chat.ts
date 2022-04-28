export type Patda = string;
export type Ship = string;

export interface MessageGraphRef {
  kind: 'graphRef';
  resourcePath: string;
}

export interface MessageImage {
  kind: 'image';
  source: string;
  altText: string;
  size: {
    height: number;
    width: number;
  };
}

export interface MessageVideo {
  kind: 'video';
  source: string;
  size: {
    height: number;
    width: number;
  };
}

export interface MessageFile {
  kind: 'file';
  source: string;
  mimeType: MimeType;
  size: number; // bytes
}

export interface MessageSticker {
  kind: 'sticker';
  image: MessageImage;
  metadata: Record<string, unknown>;
}

export interface MessageWeb2Link {
  kind: 'web2Link';
  url: string;
  boomerWeb: boolean;
  metadata: {
    title: string;
    description: string;
    image: string;
    author: string;
    section: string;
  };
}

export interface MessageLink {
  kind: 'link';
  url: string;
}

export interface MessageEmbed {
  kind: 'embed';
  url: string;
  embedProvider: string;
}

export interface MessageReact {
  kind: 'react';
  ref: MessageGraphRef;
  content: string;
}

export interface MessageDeleted {
  kind: 'deleted';
  removedBy: string;
}

export interface MessageText {
  kind: 'text';
  contentText: string;
}

export type MessageContent =
  | MessageGraphRef
  | MessageImage[]
  | MessageVideo[]
  | MessageFile[]
  | MessageSticker
  | MessageWeb2Link
  | MessageLink
  | MessageEmbed
  | MessageReact
  | MessageDeleted
  | MessageText;

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
  content: MessageContent;
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

export type ChatDiff = ChatDiffAdd | ChatDiffDel | ChatDiffAddFeel;

export interface ChatUpdate {
  time: Patda;
  diff: ChatDiff;
}
