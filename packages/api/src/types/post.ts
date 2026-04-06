import type { Block, Inline, Story } from '../urbit';
import { Attachment } from './attachment';
import type { ChannelType } from './models';

export type PostType =
  | 'block'
  | 'chat'
  | 'notice'
  | 'note'
  | 'reply'
  | 'delete';
export type PostDeliveryStatus =
  | 'enqueued'
  | 'pending'
  | 'sent'
  | 'failed'
  | 'needs_verification';

export interface ThreadUnreadState {
  channelId?: string | null;
  threadId?: string | null;
  updatedAt: number;
  count?: number | null;
  notify?: boolean | null;
  firstUnreadPostId?: string | null;
  firstUnreadPostReceivedAt?: number | null;
}

export interface Post {
  id: string;
  type: PostType;
  channelId: string;
  authorId: string;
  sentAt: number;
  receivedAt: number;
  groupId?: string | null;
  parentId?: string | null;
  title?: string | null;
  image?: string | null;
  description?: string | null;
  cover?: string | null;
  content?: unknown;
  replyCount?: number | null;
  replyTime?: number | null;
  replyContactIds?: string[] | null;
  textContent?: string | null;
  hasAppReference?: boolean | null;
  hasChannelReference?: boolean | null;
  hasGroupReference?: boolean | null;
  hasLink?: boolean | null;
  hasImage?: boolean | null;
  hidden?: boolean | null;
  isEdited?: boolean | null;
  isDeleted?: boolean | null;
  isBot?: boolean | null;
  isSequenceStub?: boolean | null;
  deletedAt?: number | null;
  deliveryStatus?: PostDeliveryStatus | null;
  editStatus?: PostDeliveryStatus | null;
  deleteStatus?: PostDeliveryStatus | null;
  lastEditContent?: unknown;
  lastEditTitle?: string | null;
  lastEditImage?: string | null;
  sequenceNum?: number | null;
  syncedAt?: number | null;
  backendTime?: string | null;
  blob?: string | null;
  draft?: unknown;
  author?: any;
  images?: any[] | null;
  reactions?: any[] | null;
  replies?: any[] | null;
  threadUnread?: ThreadUnreadState | null;
}

export type PostFlags = Pick<
  Post,
  | 'hasAppReference'
  | 'hasGroupReference'
  | 'hasChannelReference'
  | 'hasImage'
  | 'hasLink'
>;

export type PostMetadata = Pick<
  Post,
  'title' | 'image' | 'description' | 'cover'
>;

export type ReplyMeta = {
  replyCount: number;
  replyTime: number | null;
  replyContactIds: string[];
};

export interface PostImage {
  postId: string;
  src: string;
  height: number;
  width: number;
  alt?: string;
}

export interface Reaction {
  contactId: string;
  postId: string;
  value: string;
}

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

export namespace PostDataDraft {
  /**
   * Make a PostDataDraft safe for JSON serialization.
   * Converts web File objects in attachments to blob URLs.
   */
  export function serialize(draft: PostDataDraft): PostDataDraft {
    return {
      ...draft,
      attachments: draft.attachments.map(Attachment.makeSerializable),
    };
  }

  /**
   * Type guard to validate that an unknown value is a valid PostDataDraft.
   * Used when deserializing drafts from the database.
   */
  export function isValid(value: unknown): value is PostDataDraft {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const obj = value as Record<string, unknown>;
    const hasRequiredFields =
      typeof obj.channelId === 'string' &&
      Array.isArray(obj.content) &&
      Array.isArray(obj.attachments) &&
      typeof obj.channelType === 'string';

    if (!hasRequiredFields) {
      return false;
    }

    // Validate replyToPostId is string or null
    if (obj.replyToPostId !== null && typeof obj.replyToPostId !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Revoke any blob URLs created during serialization.
   * Call this when the draft is no longer needed (e.g., after successful send).
   */
  export function revokeBlobUrls(draft: PostDataDraft): void {
    for (const att of draft.attachments) {
      if (
        (att.type === 'file' || att.type === 'video') &&
        typeof att.localFile === 'string'
      ) {
        // Only revoke blob: URLs, not file:// or other URLs
        if (att.localFile.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(att.localFile);
          } catch {
            // Ignore errors - URL may have already been revoked
          }
        }
      }
    }
  }
}
