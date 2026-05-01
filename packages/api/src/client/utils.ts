import { render, valid } from '@urbit/aura';

import type * as api from '../client';
import {
  isBotUserId,
  isDmChannelId,
  isGroupDmChannelId,
} from '../client/apiUtils';
import type { Stringified } from '../lib/utilityTypes';
import {
  IMAGE_REGEX,
  convertToAscii,
  isValidUrl,
  simpleHash,
} from '../lib/utils';
import * as domain from '../types';
import type * as db from '../types/models';
import * as ub from '../urbit';

export const PATP_REGEX = /(~[a-z0-9-]+)/i;
export const REF_REGEX = /\/1\/(chan|group|desk)\/[^\s]+/g;
export const REF_URL_REGEX = /^\/1\/(chan|group|desk)\/[^\s]+/;
// sig and hep explicitly left out
export const PUNCTUATION_REGEX = /[.,/#!$%^&*;:{}=_`()]/g;

// Characters that look like tilde (~) and could be confusing
export const SIG_LIKES = [
  '\u007E', // ~ (tilde)
  '\u02DC', // ˜ (small tilde)
  '\u223C', // ∼ (tilde operator)
  '\u301C', // 〜 (wave dash)
  '\uFF5E', // ～ (fullwidth tilde)
  '\u2053', // ⁓ (swung dash)
  '\u2241', // ≁ (not tilde)
];

export type NicknameValidationErrorType =
  | 'confusable_characters'
  | 'invalid_patp'
  | 'wrong_user_id';

export type NicknameValidationResult =
  | { isValid: true }
  | {
      isValid: false;
      errorType: NicknameValidationErrorType;
    };

/**
 * Validates a nickname against several rules:
 * - Cannot contain characters that look like ~ (confusable characters)
 * - If it contains ~, it must be a valid patp
 * - If it contains a patp, it must be the current user's ID
 *
 * Uses Unicode normalization (NFKC) to handle confusable characters before validation.
 *
 * @param nickname The nickname to validate
 * @param currentUserId The current user's ID (patp)
 * @returns A validation result object with isValid flag and optional errorType
 */
export function validateNickname(
  nickname: string,
  currentUserId: string
): NicknameValidationResult {
  if (!nickname || nickname.length === 0) {
    return { isValid: true };
  }

  // Normalize unicode characters to handle confusables
  const normalizedNickname = nickname.normalize('NFKC');

  // Check for confusable characters (characters that look like ~)
  for (let i = 0; i < normalizedNickname.length; i++) {
    const char = normalizedNickname[i];
    const isConfusable = SIG_LIKES.some((sig: string) => sig === char);

    if (isConfusable && char !== '~') {
      return {
        isValid: false,
        errorType: 'confusable_characters',
      };
    }
  }

  // Check for patps in the nickname (use normalized version)
  if (normalizedNickname.includes('~')) {
    const matches = normalizedNickname.match(new RegExp(PATP_REGEX, 'gi'));
    if (matches) {
      for (const match of matches) {
        if (!valid('p', match)) {
          return {
            isValid: false,
            errorType: 'invalid_patp',
          };
        }
        if (match !== currentUserId) {
          return {
            isValid: false,
            errorType: 'wrong_user_id',
          };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Returns a user-friendly error message for a nickname validation error.
 * @param errorType The type of validation error
 * @returns A human-readable error message
 */
export function getNicknameErrorMessage(
  errorType: NicknameValidationErrorType
): string {
  switch (errorType) {
    case 'confusable_characters':
      return 'Nickname cannot contain characters that look like ~';
    case 'invalid_patp':
      return 'You can only use your own ID in your nickname';
    case 'wrong_user_id':
      return 'You can only use your own ID in your nickname';
  }
}

export function getFlagParts(flag: string) {
  const parts = flag.split('/');

  return {
    ship: parts[0],
    name: parts[1],
  };
}

export function getNestParts(nest: string) {
  const parts = nest.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid nest format: ${nest}`);
  }

  return {
    type: parts[0],
    ship: parts[1],
    name: parts[2],
  };
}

export function getPrettyAppName(kind: 'chat' | 'diary' | 'heap') {
  switch (kind) {
    case 'chat':
      return 'Chat';
    case 'diary':
      return 'Notebook';
    case 'heap':
      return 'Gallery';
  }
}

export function normalizeUrbitColor(color?: string | null): string | null {
  if (!color) {
    return null;
  }

  if (color.startsWith('#')) {
    return color;
  }

  const noDots = color.replace('.', '');
  const prefixStripped = color.startsWith('0x') ? noDots.slice(2) : noDots;
  const lengthAdjustedColor = prefixStripped.toUpperCase().padStart(6, '0');
  return `#${lengthAdjustedColor}`;
}

export const appendContactIdToReplies = (
  existingReplies: string[],
  contactId: string
): string[] => {
  const newArray = [...existingReplies];
  const index = newArray.indexOf(contactId);
  if (index !== -1) {
    newArray.splice(index, 1);
  }
  newArray.push(contactId);
  return newArray;
};

export const createShortCodeFromTitle = (title: string): string => {
  const shortCode = convertToAscii(title).replace(
    /[^a-z]*([a-z][-\w\d]+)/i,
    '$1'
  );
  return shortCode;
};

export function extractInlinesFromContent(story: api.PostContent): ub.Inline[] {
  const inlines =
    story !== null
      ? (story.filter((v) => 'inline' in v) as ub.VerseInline[]).flatMap(
          (i) => i.inline
        )
      : [];

  return inlines;
}

export function extractReferencesFromContent(
  story: api.PostContent
): domain.ContentReference[] {
  const references =
    story !== null
      ? (story.filter(
          (s) => 'type' in s && s.type == 'reference'
        ) as domain.ContentReference[])
      : [];

  return references;
}

export function extractBlocksFromContent(story: api.PostContent): ub.Block[] {
  const blocks =
    story !== null
      ? (story.filter((v) => 'block' in v) as ub.VerseBlock[]).flatMap(
          (b) => b.block
        )
      : [];

  return blocks;
}

export const extractContentTypes = (
  content: Stringified<api.PostContent> | api.PostContent
): {
  inlines: ub.Inline[];
  references: domain.ContentReference[];
  blocks: ub.Block[];
  story: api.PostContent;
} => {
  const story = typeof content === 'string' ? JSON.parse(content) : content;
  const inlines = extractInlinesFromContent(story);
  const references = extractReferencesFromContent(story);
  const blocks = extractBlocksFromContent(story);

  return { inlines, references, blocks, story };
};

export const extractContentTypesFromPost = (
  post: db.Post | { content: api.PostContent }
): {
  inlines: ub.Inline[];
  references: domain.ContentReference[];
  blocks: ub.Block[];
  story: api.PostContent;
} => {
  const { inlines, references, blocks, story } = extractContentTypes(
    post.content as Stringified<api.PostContent>
  );

  return { inlines, references, blocks, story };
};

export const isTextPost = (post: db.Post) => {
  const { inlines, references, blocks } = extractContentTypesFromPost(post);
  return blocks.length === 0 && inlines.length > 0 && references.length === 0;
};

export const isReferencePost = (post: db.Post) => {
  const { inlines, references, blocks } = extractContentTypesFromPost(post);
  return blocks.length === 0 && inlines.length === 0 && references.length === 1;
};

export const isImagePost = (post: db.Post) => {
  const { blocks } = extractContentTypesFromPost(post);
  return blocks.length === 1 && blocks.some((b) => 'image' in b);
};

export const isRichLinkPost = (post: db.Post) => {
  const { blocks } = extractContentTypesFromPost(post);
  return blocks.length === 1 && blocks.some((b) => 'link' in b);
};

export function getRichLinkMetadata(block: ub.Block):
  | {
      url: string;
      title?: string;
      description?: string;
      image?: string;
    }
  | undefined {
  if (!('link' in block)) {
    return undefined;
  }
  const { link } = block;
  const {
    url,
    meta: { title, description, image },
  } = link;
  return {
    url,
    title,
    description,
    image,
  };
}

export const findFirstImageBlock = (blocks: ub.Block[]): ub.Image | null => {
  return blocks.find((b) => 'image' in b) as ub.Image;
};

export const textPostIsLinkedImage = (post: db.Post): boolean => {
  const postIsJustText = isTextPost(post);
  if (!postIsJustText) {
    return false;
  }

  const { inlines } = extractContentTypesFromPost(post);

  if (inlines.length <= 2) {
    const [first] = inlines;
    if (typeof first === 'object' && 'link' in first) {
      const link = first as ub.Link;
      const { href } = link.link;
      const isImage = IMAGE_REGEX.test(href);

      return isImage;
    }
  }

  return false;
};

export const textPostIsLink = (post: db.Post): boolean => {
  const postIsJustText = isTextPost(post);
  if (!postIsJustText) {
    return false;
  }

  const postIsImage = textPostIsLinkedImage(post);
  if (postIsImage) {
    return false;
  }

  const { inlines } = extractContentTypesFromPost(post);

  if (inlines.length <= 2) {
    const [first] = inlines;
    if (typeof first === 'object' && 'link' in first) {
      const link = first as ub.Link;
      const { href } = link.link;
      const isLink = isValidUrl(href);

      return isLink;
    }
  }

  return false;
};

export const textPostIsReference = (post: db.Post): boolean => {
  const { inlines, references } = extractContentTypesFromPost(post);
  if (references.length === 0) {
    return false;
  }

  if (inlines.length === 2) {
    const [first] = inlines;
    const isRefString =
      typeof first === 'string' && REF_REGEX.test(first as string);

    if (isRefString) {
      return true;
    }
  }

  if (
    inlines.length === 1 &&
    typeof inlines[0] === 'object' &&
    'break' in inlines[0]
  ) {
    return true;
  }

  return false;
};

export const getPostTypeFromChannelId = ({
  channelId,
  parentId,
}: {
  channelId?: string | null;
  parentId?: string | null;
}): db.PostType => {
  if (!channelId) return 'chat';
  const isDm = isDmChannelId(channelId) || isGroupDmChannelId(channelId);
  if (parentId) {
    return 'reply';
  } else if (isDm) {
    return 'chat';
  } else {
    const idType = channelId.split('/')[0];
    if (idType === 'diary') {
      return 'note';
    } else if (idType === 'heap') {
      return 'block';
    } else {
      return 'chat';
    }
  }
};

export const getCompositeGroups = (
  groups: db.Group[],
  base: Partial<db.Group>[]
): db.Group[] => {
  const baseIndex = base.reduce(
    (acc, curr) => {
      if (curr.id) {
        acc[curr.id] = curr;
      }
      return acc;
    },
    {} as Record<string, Partial<db.Group>>
  );

  return groups.map((group) => {
    const baseGroup = baseIndex[group.id] ?? {};
    return { ...baseGroup, ...group };
  });
};

/**
 * Random id value for group or channel, 4 bits of entropy, eg 0v2a.lmibb -> v2almibb
 */
export function getRandomId() {
  const id = render('uv', BigInt(Math.floor(Math.random() * 0xffffffff)));
  return id.replace(/\./g, '').slice(1);
}

export function isBotDmChannel({
  post,
  channel,
}: {
  post?: Partial<db.Post> | null;
  channel?: Partial<db.Channel> | null;
}): boolean {
  const channelId = channel?.id ?? post?.channelId;
  if (!channelId || !isDmChannelId(channelId)) {
    return false;
  }

  return isBotUserId(channel?.contactId ?? channelId);
}

const wayfindingGroup = domain.PersonalGroupSlugs;
function isWayfindingChannel(id: string | null | undefined): boolean {
  if (!id) return false;
  if (isDmChannelId(id)) return false;
  if (isGroupDmChannelId(id)) return false;

  const channelParts = getNestParts(id);
  return [
    wayfindingGroup.chatSlug,
    wayfindingGroup.collectionSlug,
    wayfindingGroup.notebookSlug,
  ].includes(channelParts.name);
}

function isWayfindingGroup(id: string | null | undefined): boolean {
  if (!id) return false;
  const groupParts = getFlagParts(id);
  return groupParts.name === wayfindingGroup.slug;
}

export function getModelAnalytics({
  post,
  group,
  channel,
}: {
  post?: Partial<db.Post> | null;
  group?: Partial<db.Group> | null;
  channel?: Partial<db.Channel> | null;
}) {
  const details: Record<string, string | boolean | null> = {};

  const isWayfindingGroupId = isWayfindingGroup(group?.id);
  const channelId = channel?.id || post?.channelId;
  const isWayfindingChannelId = isWayfindingChannel(channelId);

  if (isWayfindingGroupId || isWayfindingChannelId) {
    details.isPersonalGroup = true;
  }

  const isTlonTeamDM = channelId === '~wittyr-witbes'; // Tlon Team node
  if (isTlonTeamDM) {
    details.isTlonTeamDM = true;
  }

  // we want to mask all group/channel IDs unless:
  // 1. it's the default wayfinding group
  // 2. it's the Tlon Team DM
  const getMaskedId = (id: string | null | undefined) => {
    if (!id) return null;
    if (isWayfindingGroupId || isWayfindingChannelId) {
      return id;
    }

    if (isTlonTeamDM) {
      return id;
    }

    return id ? simpleHash(id) : null;
  };

  if (post) {
    details.postId = post.sentAt ? simpleHash(post.sentAt.toString()) : null;
    details.channelId = getMaskedId(post.channelId);
  }

  if (channel) {
    details.channelId = getMaskedId(channel.id);
    details.channelType = channel.type ?? null;
    details.groupId = getMaskedId(channel.groupId);
  }

  if (group) {
    details.groupId = getMaskedId(group.id);
    details.groupType =
      (group.channels?.length ?? 1) > 1 ? 'multi-topic' : 'groupchat';
    details.groupPrivacy = group.privacy ?? null;
  }

  return details;
}
