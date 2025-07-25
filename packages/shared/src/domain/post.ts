import type { ChannelType } from '../db/schema';
import type { PostMetadata } from '../db/types';
import { Block, Inline, Story } from '../urbit';
import { Attachment } from './attachment';

interface _PostDataDraftBase {
  channelId: string;
  content: (Inline | Block)[];
  attachments: Attachment[];
  channelType: ChannelType;
  title?: string;
  image?: string;
}
export interface PostDataDraftParent extends _PostDataDraftBase {
  isEdit?: false;
  parentId?: undefined;
}
export interface PostDataDraftEdit extends _PostDataDraftBase {
  isEdit: true;
  parentId: string;
}

/**
 * A static, frozen version of a post draft that can be used to create a post.
 * In other words, this has everything you need to initiate sending a post.
 * Attachments need to be finalized before sending.
 */
export type PostDataDraft = PostDataDraftParent | PostDataDraftEdit;

interface _PostDataFinalizedBase {
  channelId: string;
  content: Story;
  metadata?: PostMetadata;
}

/**
 * Finalized "normal" post (i.e. not an edit).
 */
export interface PostDataFinalizedParent extends _PostDataFinalizedBase {
  isEdit?: false;
}

export interface PostDataFinalizedEdit extends _PostDataFinalizedBase {
  isEdit: true;
  parentId?: string;
}

/**
 * A post that's ready to head down to the network.
 * Nothing left to do but send it.
 */
export type PostDataFinalized = PostDataFinalizedParent | PostDataFinalizedEdit;
