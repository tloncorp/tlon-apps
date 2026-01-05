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
  replyToPostId: string | null;
}
/** Draft for an original, non-edit post */
export interface PostDataDraftPost extends _PostDataDraftBase {
  isEdit?: false;
}
export interface PostDataDraftEdit extends _PostDataDraftBase {
  isEdit: true;
  editTargetPostId: string;
}

/**
 * A static, frozen version of a post draft that can be used to create a post.
 * In other words, this has everything you need to initiate sending a post.
 * Attachments need to be finalized before sending.
 */
export type PostDataDraft = PostDataDraftPost | PostDataDraftEdit;

interface _PostDataFinalizedBase {
  channelId: string;
  content: Story;
  blob?: string;
  metadata?: PostMetadata;
  replyToPostId: string | null;
}

/**
 * Finalized "normal" post (i.e. not an edit).
 */
export interface PostDataFinalizedParent extends _PostDataFinalizedBase {
  isEdit?: false;
}

export interface PostDataFinalizedEdit extends _PostDataFinalizedBase {
  isEdit: true;
  editTargetPostId: string;
}

/**
 * A post that's ready to head down to the network.
 * Nothing left to do but send it.
 */
export type PostDataFinalized = PostDataFinalizedParent | PostDataFinalizedEdit;
