export interface ChannelReference {
  type: 'reference';
  referenceType: 'channel';
  channelId: string;
  postId: string;
  replyId?: string;
}

/** A whole channel, cited as /1/chan/<nest> with no post. */
export interface ChannelLinkReference {
  type: 'reference';
  referenceType: 'channelLink';
  channelId: string;
}

export interface GroupReference {
  type: 'reference';
  referenceType: 'group';
  groupId: string;
}

export interface AppReference {
  type: 'reference';
  referenceType: 'app';
  userId: string;
  appId: string;
}

export interface NoteReference {
  type: 'reference';
  referenceType: 'note';
  /** notes channel id, e.g. notes/~host/notebook-slug */
  channelId: string;
  noteId: string;
}

export type ContentReference =
  | ChannelReference
  | ChannelLinkReference
  | GroupReference
  | AppReference
  | NoteReference;
