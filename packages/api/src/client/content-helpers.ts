import isURL from 'validator/lib/isURL.js';
import { z } from 'zod';

import { createDevLogger } from '../lib/logger';
import {
  FinalizedAttachment,
  LinkAttachment,
  ReferenceAttachment,
  UploadedFileAttachment,
  UploadedImageAttachment,
  UploadedVideoAttachment,
  uploadStateUri,
} from '../types';
import type { ChannelType, PostMetadata } from '../types/models';
import {
  Block,
  Inline,
  JSONContent,
  Story,
  constructStory,
  pathToCite,
} from '../urbit';
import { A2UI } from './a2ui';

export * from './a2ui';

const logger = createDevLogger('content-helpers', false);

const makeText = (text: string): JSONContent => ({
  type: 'text',
  text,
});

const makeMention = (id: string): JSONContent => ({
  type: 'mention',
  attrs: { id },
});

const makeParagraph = (content?: JSONContent[]): JSONContent => {
  const paragraph: JSONContent = { type: 'paragraph' };

  if (!content) {
    return paragraph;
  }

  if (
    content.length > 0 &&
    content[0].type === 'text' &&
    content[0].text === ''
  ) {
    return paragraph;
  }

  return { ...paragraph, content };
};

function filenameFromPath(
  path: string,
  opts: { decodeURI?: boolean } = {}
): string | null {
  if (path.endsWith('/')) {
    return null;
  }

  let out = path.split('/').pop() ?? null;
  if (opts.decodeURI && out) {
    out = decodeURIComponent(out);
  }

  return out;
}

const isBoldStart = (text: string): boolean => {
  return text.startsWith('**');
};

const isBoldEnd = (text: string): boolean => {
  return text.endsWith('**');
};

const isItalicStart = (text: string): boolean => {
  return text.startsWith('*');
};

const isItalicEnd = (text: string): boolean => {
  return text.endsWith('*');
};

const isCodeStart = (text: string): boolean => {
  return text.startsWith('`');
};

const isCodeEnd = (text: string): boolean => {
  return /`[^`]*$/.test(text);
};

const getCodeEndIndex = (text: string): number => {
  const match = text.match(/`[^`]*$/);
  if (!match) return -1;
  return text.lastIndexOf('`');
};

const isUrl = (text: string): boolean => {
  return isURL(text);
};

function areMarksEqual(
  marks1: Record<string, unknown>[] = [],
  marks2: Record<string, unknown>[] = []
): boolean {
  if (marks1.length !== marks2.length) return false;
  return marks1.every((mark1, i) => {
    const mark2 = marks2[i];
    return (
      mark1.type === mark2.type &&
      JSON.stringify(mark1.attrs || {}) === JSON.stringify(mark2.attrs || {})
    );
  });
}

// Merge adjacent text nodes with the same marks
function mergeTextNodes(nodes: JSONContent[]): JSONContent[] {
  const merged: JSONContent[] = [];
  let currentNode: JSONContent | null = null;

  nodes.forEach((node) => {
    if (!currentNode) {
      currentNode = { ...node };
      return;
    }

    if (
      currentNode.type === 'text' &&
      node.type === 'text' &&
      areMarksEqual(currentNode.marks, node.marks)
    ) {
      currentNode.text! += node.text;
    } else {
      merged.push(currentNode);
      currentNode = { ...node };
    }
  });

  if (currentNode) {
    merged.push(currentNode);
  }

  return merged;
}

export interface Mention {
  id: string;
  display: string;
  start: number;
  end: number;
}

interface TextNode {
  type: 'text';
  text: string;
}

interface MentionNode {
  type: 'mention';
  mention: Mention;
}

type LineNode = TextNode | MentionNode;

interface Line {
  text: string;
  mentions: Mention[];
}

const processLine = (line: Line): JSONContent => {
  const { text: rawText, mentions } = line;
  const text = rawText.trim();
  const parsedContent: JSONContent[] = [];
  let isBolding = false;
  let isItalicizing = false;
  let isCoding = false;
  let isEndOfFormatting = false;

  if (text.startsWith('> ')) {
    const quotedContent = processLine({ text: text.slice(2), mentions });
    return {
      type: 'blockquote',
      content: [quotedContent],
    };
  }

  let segments: LineNode[] =
    mentions.length === 0
      ? text.split(' ').map((word) => ({ type: 'text', text: word }))
      : [];
  let index = 0;
  for (const [i, mention] of mentions.entries()) {
    const nextSegment = text.slice(index, mention.start);
    const parts: string[] = nextSegment === '' ? [] : nextSegment.split(' ');
    const partsUptoMention: LineNode[] = parts.map((word) => ({
      type: 'text',
      text: word,
    }));

    segments = [...segments, ...partsUptoMention];

    segments.push({
      type: 'mention',
      mention,
    });

    index = mention.end;

    if (i === mentions.length - 1) {
      const lastSegment = text.slice(index);
      if (lastSegment) {
        const parts: LineNode[] = lastSegment.split(' ').map((word) => ({
          type: 'text',
          text: word,
        }));
        segments = [...segments, ...parts];
      }
    }
  }

  segments.forEach((node) => {
    const marks = [];

    if (node.type === 'mention') {
      parsedContent.push(makeMention(node.mention.id));
      return;
    }

    let word = node.text;
    if (isUrl(word)) {
      const leadingPunct = word.match(/^[^\w\s]/)?.[0] || '';
      const trailingPunct = word.match(/[,?!.]$/)?.[0] || '';
      const cleanUrl = word.slice(
        leadingPunct.length,
        trailingPunct ? -1 : undefined
      );

      if (leadingPunct) {
        parsedContent.push(makeText(leadingPunct));
      }

      parsedContent.push({
        type: 'text',
        text: cleanUrl,
        marks: cleanUrl.startsWith('http')
          ? [
              {
                type: 'link',
                attrs: {
                  href: cleanUrl,
                },
              },
            ]
          : undefined,
      });

      if (trailingPunct) {
        parsedContent.push(makeText(trailingPunct));
      }

      parsedContent.push(makeText(' '));
      return;
    }

    if (isCodeStart(word)) {
      isCoding = true;
      word = word.slice(1);
    }

    if (isCoding) {
      marks.push({ type: 'code' });
      if (isCodeEnd(word)) {
        isEndOfFormatting = true;
        isCoding = false;
        const endIndex = getCodeEndIndex(word);
        const codeContent = word.slice(0, endIndex);
        const afterBacktick = word.slice(endIndex + 1);

        if (codeContent) {
          parsedContent.push({
            ...makeText(codeContent),
            marks,
          });
        }

        if (!afterBacktick) {
          parsedContent.push(makeText(' '));
        } else {
          parsedContent.push(makeText(afterBacktick));
          parsedContent.push(makeText(' '));
        }

        return;
      }

      parsedContent.push({
        ...makeText(word),
        marks,
      });

      parsedContent.push({ ...makeText(' '), marks });
      return;
    }

    // A word can be both bold and italicized
    if (isBoldStart(word)) {
      isBolding = true;
      word = word.slice(2);
    }

    if (isItalicStart(word)) {
      isItalicizing = true;
      word = word.slice(1);
    }

    if (isBolding) {
      marks.push({ type: 'bold' });
      if (isBoldEnd(word)) {
        isBolding = false;
        isEndOfFormatting = true;
        word = word.slice(0, -2);
      }
    }

    if (isItalicizing) {
      marks.push({ type: 'italics' });
      if (isItalicEnd(word)) {
        isItalicizing = false;
        isEndOfFormatting = true;
        word = word.slice(0, -1);
      }
    }

    if (marks.length > 0) {
      parsedContent.push({
        ...makeText(word),
        marks,
      });

      if (isEndOfFormatting) {
        parsedContent.push(makeText(' '));
        isEndOfFormatting = false;
        return;
      }

      parsedContent.push({
        ...makeText(' '),
        marks,
      });
      return;
    } else {
      parsedContent.push(makeText(word));
      parsedContent.push(makeText(' '));
    }
  });

  return makeParagraph(mergeTextNodes(parsedContent));
};

function processTextLines(lines: Line[]): JSONContent[] {
  return lines.map(processLine);
}

export function textAndMentionsToContent(
  text: string,
  mentions: Mention[]
): JSONContent {
  if (text === '') {
    return [];
  }

  const lines = text.split('\n');
  const content: JSONContent[] = [];
  let currentLines: Line[] = [];
  let inCodeBlock = false;
  let currentCodeBlock: Line[] = [];
  const language = 'plaintext';
  const normalizedLines: Line[] = [];
  let absoluteStart = 0;
  lines.forEach((line) => {
    const absoluteEnd = absoluteStart + line.length + 1;
    const found = mentions.filter(
      (mention) => mention.start >= absoluteStart && mention.end < absoluteEnd
    );
    normalizedLines.push({
      text: line,
      mentions: found.map((mention) => ({
        ...mention,
        start: mention.start - absoluteStart,
        end: mention.end - absoluteStart,
      })),
    });
    absoluteStart += line.length + 1;
  });

  normalizedLines.forEach((line) => {
    const { text } = line;
    if (text.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentLines.length > 0) {
          content.push(...processTextLines(currentLines));
          currentLines = [];
        }

        inCodeBlock = true;
      } else {
        inCodeBlock = false;
        content.push({
          type: 'codeBlock',
          content: [
            {
              type: 'text',
              text: currentCodeBlock.map((line) => line.text).join('\n'),
            },
          ],
          attrs: {
            language,
          },
        });
        currentCodeBlock = [];
      }
    } else if (inCodeBlock) {
      currentCodeBlock.push(line);
    } else {
      currentLines.push(line);
    }
  });

  if (inCodeBlock && currentCodeBlock.length > 0) {
    content.push({
      type: 'codeBlock',
      content: [
        {
          type: 'text',
          text: currentCodeBlock.map((line) => line.text).join('\n'),
        },
      ],
      attrs: {
        language,
      },
    });
  }

  if (currentLines.length > 0) {
    content.push(...processTextLines(currentLines));
  }

  return {
    type: 'doc',
    content,
  };
}

export function contentToTextAndMentions(jsonContent: JSONContent): {
  text: string;
  mentions: Mention[];
} {
  const text: string[] = [];
  const mentions: Mention[] = [];
  const content = jsonContent.content;

  if (!content) {
    return {
      text: '',
      mentions: [],
    };
  }

  let paragrahCount = 0;
  content.forEach((node) => {
    if (node.type === 'paragraph') {
      if (paragrahCount > 0) {
        text.push('\n');
      }
      paragrahCount++;
      if (!node.content) {
        return;
      }

      let isBolding = false;
      let isItalicizing = false;
      let isCoding = false;
      let lastMarks: string[] = [];
      node.content.forEach((child) => {
        if (child.type === 'text') {
          if (!child.text) {
            return;
          }
          if (child.marks) {
            child.marks.forEach((mark) => {
              if (mark.type === 'bold') {
                isBolding = true;
              } else if (mark.type === 'italics') {
                isItalicizing = true;
              } else if (mark.type === 'code') {
                isCoding = true;
              }
            });

            if (isBolding && !lastMarks.includes('bold')) {
              text.push('**');
            }

            if (isItalicizing && !lastMarks.includes('italics')) {
              text.push('*');
            }

            if (isCoding && !lastMarks.includes('code')) {
              text.push('`');
            }

            text.push(child.text);

            if (isBolding && !lastMarks.includes('bold')) {
              text.push('**');
            }

            if (isItalicizing && !lastMarks.includes('italics')) {
              text.push('*');
            }

            if (isCoding && !lastMarks.includes('code')) {
              text.push('`');
            }

            lastMarks = child.marks.map((mark) => mark.type);
          } else {
            text.push(child.text);
          }
        } else if (child.type === 'mention') {
          if (!child.attrs || !child.attrs.id) {
            return;
          }

          const id = child.attrs.id;
          const mentionText = id.startsWith('~') ? id : `~${id}`;
          const mentionStartIndex = text.join('').length;

          text.push(mentionText);

          mentions.push({
            id,
            display: mentionText,
            start: mentionStartIndex,
            end: mentionStartIndex + mentionText.length,
          });
        }
      });
    } else if (node.type === 'codeBlock') {
      if (!node.content || !node.content[0].text) {
        return;
      }
      text.push('```\n');
      text.push(node.content[0].text);
      text.push('\n```\n');
    } else if (node.type === 'blockquote') {
      if (!node.content) {
        return;
      }
      text.push('> ');
      node.content.forEach((child, index) => {
        if (child.type === 'paragraph' && child.content) {
          child.content.forEach((content) => {
            if (content.type === 'text' && content.text) {
              text.push(content.text);
            }
          });
          if (index < node.content!.length - 1) {
            text.push('\n> ');
          }
        }
      });
      text.push('\n');
    }
  });

  return {
    text: text.join(''),
    mentions,
  };
}

/** helper to build similarly-shaped entry types */
function definePostBlobDataEntrySchema<
  Type extends string,
  Version extends number,
  Payload extends z.ZodRawShape,
>(type: Type, version: Version, payload: Payload) {
  return z.object({
    type: z.literal(type),
    version: z.literal(version),
    ...payload,
  });
}

function safeParseArrayWithFallback<
  ItemSchema extends z.ZodTypeAny,
  InputElement,
  Fallback,
>(
  itemSchema: ItemSchema,
  fallback: (failed: InputElement) => Fallback,
  data: InputElement[]
): Array<z.infer<ItemSchema> | Fallback> {
  return data.map((entry) => {
    const parsed = itemSchema.safeParse(entry);
    return parsed.success ? parsed.data : fallback(entry);
  });
}

export type MiniAppJSONValue =
  | null
  | string
  | number
  | boolean
  | MiniAppJSONValue[]
  | { [key: string]: MiniAppJSONValue };

const miniAppLimits = {
  maxBundleBytes: 512_000,
  maxSourceBytes: 256_000,
  maxActionBytes: 4_000,
  maxStateBytes: 128_000,
  maxRenderBytes: 256_000,
  maxJsonDepth: 16,
  maxJsonKeys: 100,
} as const;

function jsonStringSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? Infinity;
  } catch {
    return Infinity;
  }
}

function isSerializableJsonValue(value: unknown, depth = 0): boolean {
  if (depth > miniAppLimits.maxJsonDepth) {
    return false;
  }
  if (value === null) {
    return true;
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (Array.isArray(value)) {
        return value.every((item) => isSerializableJsonValue(item, depth + 1));
      }
      if (
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      ) {
        return false;
      }
      const entries = Object.entries(value);
      return (
        entries.length <= miniAppLimits.maxJsonKeys &&
        entries.every(([, child]) => isSerializableJsonValue(child, depth + 1))
      );
    }
    default:
      return false;
  }
}

const miniAppJsonValueSchema: z.ZodType<MiniAppJSONValue> = z.custom((value) =>
  isSerializableJsonValue(value)
);

const miniAppRuntimeV1Schema = z.literal('js-worker-miniapp-v1');

export const MiniAppSnapshotPolicySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('manual') }),
    z.object({
      kind: z.literal('every'),
      actionCount: z.number().int().positive().max(500),
    }),
  ])
  .default({ kind: 'none' });

export type MiniAppSnapshotPolicy = z.infer<typeof MiniAppSnapshotPolicySchema>;

const postBlobSizeSchema = z
  .number()
  .finite()
  // Existing upload flows use -1 when size is unknown.
  .refine((size) => size >= 0 || size === -1, {
    message: 'size must be nonnegative or -1',
  });

export const PostBlobDataEntryFileSchema = definePostBlobDataEntrySchema(
  'file',
  1,
  {
    fileUri: z.string().min(1),
    mimeType: z.string().optional(),
    name: z.string().optional(),
    /** in bytes */
    size: postBlobSizeSchema,
  }
);

export type PostBlobDataEntryFile = z.infer<typeof PostBlobDataEntryFileSchema>;

export const PostBlobDataEntryVoiceMemoSchema = definePostBlobDataEntrySchema(
  'voicememo',
  1,
  {
    fileUri: z.string().min(1),
    /** in bytes */
    size: postBlobSizeSchema,
    transcription: z.string().optional(),
    /** waveform preview; values should be between 0 and 1 */
    waveformPreview: z.array(z.number().finite().min(0).max(1)).optional(),
    /** in seconds */
    duration: z.number().finite().nonnegative().optional(),
  }
);

export type PostBlobDataEntryVoiceMemo = z.infer<
  typeof PostBlobDataEntryVoiceMemoSchema
>;

export const PostBlobDataEntryVideoSchema = definePostBlobDataEntrySchema(
  'video',
  1,
  {
    fileUri: z.string().min(1),
    mimeType: z.string().optional(),
    name: z.string().optional(),
    /** in bytes */
    size: postBlobSizeSchema,
    /** in pixels */
    width: z.number().finite().nonnegative().optional(),
    /** in pixels */
    height: z.number().finite().nonnegative().optional(),
    /** in seconds */
    duration: z.number().finite().nonnegative().optional(),
    /** local preview URI (optional in v1) */
    posterUri: z.string().optional(),
  }
);

export type PostBlobDataEntryVideo = z.infer<
  typeof PostBlobDataEntryVideoSchema
>;

export const MiniAppPostBlobSchema = definePostBlobDataEntrySchema(
  'tlon-mini-app',
  1,
  {
    appId: z.string().min(1).max(128),
    runtime: miniAppRuntimeV1Schema,
    title: z.string().min(1).max(140),
    description: z.string().max(500).nullable().optional(),
    bundleUri: z.string().min(1).max(2048),
    bundleSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    bundleBytes: z.number().int().positive().max(miniAppLimits.maxBundleBytes),
    createdAt: z.number().finite().nonnegative().optional(),
    requires: z.array(z.string().min(1).max(80)).max(20).optional(),
    summary: z.string().max(1000).optional(),
    snapshotPolicy: MiniAppSnapshotPolicySchema.optional().default({
      kind: 'none',
    }),
  }
);

export type MiniAppPostBlob = z.infer<typeof MiniAppPostBlobSchema>;

export const MiniAppBundleSchema = z.object({
  type: z.literal('tlon-mini-app-bundle'),
  version: z.literal(1),
  appId: z.string().min(1).max(128),
  runtime: miniAppRuntimeV1Schema,
  title: z.string().min(1).max(140),
  source: z
    .string()
    .refine((source) => source.length <= miniAppLimits.maxSourceBytes, {
      message: 'source exceeds mini app V1 limit',
    }),
  initialState: miniAppJsonValueSchema.refine(
    (state) => jsonStringSize(state) <= miniAppLimits.maxStateBytes,
    {
      message: 'initialState exceeds mini app V1 limit',
    }
  ),
  initialRender: miniAppJsonValueSchema
    .refine(
      (render) => jsonStringSize(render) <= miniAppLimits.maxRenderBytes,
      {
        message: 'initialRender exceeds mini app V1 limit',
      }
    )
    .optional(),
});

export type MiniAppBundle = z.infer<typeof MiniAppBundleSchema>;

export const MiniAppActionBlobSchema = definePostBlobDataEntrySchema(
  'tlon-mini-app-action',
  1,
  {
    appId: z.string().min(1).max(128),
    actionId: z.string().min(1).max(128),
    action: miniAppJsonValueSchema.refine(
      (action) => jsonStringSize(action) <= miniAppLimits.maxActionBytes,
      {
        message: 'action exceeds mini app V1 limit',
      }
    ),
    createdAt: z.number().finite().nonnegative(),
  }
);

export type MiniAppActionBlob = z.infer<typeof MiniAppActionBlobSchema>;

export const MiniAppSnapshotBlobSchema = definePostBlobDataEntrySchema(
  'tlon-mini-app-snapshot',
  1,
  {
    appId: z.string().min(1).max(128),
    snapshotId: z.string().min(1).max(128),
    throughPostId: z.string().min(1).max(256),
    throughSequence: z.number().int().nonnegative(),
    state: miniAppJsonValueSchema.refine(
      (state) => jsonStringSize(state) <= miniAppLimits.maxStateBytes,
      {
        message: 'snapshot state exceeds mini app V1 limit',
      }
    ),
    stateSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    actionCount: z.number().int().nonnegative(),
    createdAt: z.number().finite().nonnegative(),
  }
);

export type MiniAppSnapshotBlob = z.infer<typeof MiniAppSnapshotBlobSchema>;

const postBlobMusicExternalIdsSchema = z.record(
  z.string().min(1),
  z.string().min(1)
);

const PostBlobMusicArtistCreditSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().optional(),
  imageUrl: z.string().optional(),
  externalUrl: z.string().optional(),
  externalIds: postBlobMusicExternalIdsSchema.optional(),
});

const PostBlobMusicReleaseSummarySchema = z.object({
  id: z.string().optional(),
  sourceId: z.string().optional(),
  title: z.string().min(1),
  artist: z.string().optional(),
  artists: z.array(PostBlobMusicArtistCreditSchema).optional(),
  slug: z.string().optional(),
  coverArtUrl: z.string().optional(),
  trackCount: z.number().int().nonnegative().optional(),
  externalUrl: z.string().optional(),
  externalIds: postBlobMusicExternalIdsSchema.optional(),
});

const PostBlobMusicTrackSchema = z.object({
  id: z.string().optional(),
  source: z.string().optional(),
  sourceId: z.string().optional(),
  title: z.string().min(1),
  artists: z.array(PostBlobMusicArtistCreditSchema).optional(),
  slug: z.string().optional(),
  releaseId: z.string().optional(),
  releaseSlug: z.string().optional(),
  releaseTitle: z.string().optional(),
  duration: z.number().finite().nonnegative().optional(),
  previewUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  mimeType: z.string().optional(),
  externalUrl: z.string().optional(),
  coverArtUrl: z.string().optional(),
  metadataUri: z.string().optional(),
  trackNumber: z.number().int().positive().optional(),
  discNumber: z.number().int().positive().optional(),
  externalIds: postBlobMusicExternalIdsSchema.optional(),
});

export const PostBlobDataEntryMusicSchema = definePostBlobDataEntrySchema(
  'music',
  1,
  {
    kind: z.enum(['artist', 'release', 'album', 'track', 'playlist']),
    id: z.string().optional(),
    source: z.string().optional(),
    sourceId: z.string().optional(),
    title: z.string().min(1),
    artists: z.array(PostBlobMusicArtistCreditSchema).optional(),
    creatorName: z.string().optional(),
    slug: z.string().optional(),
    releaseId: z.string().optional(),
    releaseSlug: z.string().optional(),
    releaseTitle: z.string().optional(),
    label: z.string().optional(),
    releasedAt: z.string().optional(),
    description: z.string().optional(),
    duration: z.number().finite().nonnegative().optional(),
    coverArtUrl: z.string().optional(),
    previewUrl: z.string().optional(),
    audioUrl: z.string().optional(),
    mimeType: z.string().optional(),
    externalUrl: z.string().optional(),
    provider: z.string().optional(),
    providerUrl: z.string().optional(),
    metadataUri: z.string().optional(),
    tags: z.array(z.string()).optional(),
    trackCount: z.number().int().nonnegative().optional(),
    trackNumber: z.number().int().positive().optional(),
    discNumber: z.number().int().positive().optional(),
    releaseCount: z.number().int().nonnegative().optional(),
    sampleReleases: z
      .array(PostBlobMusicReleaseSummarySchema)
      .max(25)
      .optional(),
    tracks: z.array(PostBlobMusicTrackSchema).max(100).optional(),
    externalIds: postBlobMusicExternalIdsSchema.optional(),
  }
);

export type PostBlobMusicArtistCredit = z.infer<
  typeof PostBlobMusicArtistCreditSchema
>;

export type PostBlobMusicTrack = z.infer<typeof PostBlobMusicTrackSchema>;

export type PostBlobDataEntryMusic = z.infer<
  typeof PostBlobDataEntryMusicSchema
>;

export type PostBlobMusicEntryInput = Omit<
  PostBlobDataEntryMusic,
  'type' | 'version'
>;

const postBlobDataEntryDefinitions = [
  PostBlobDataEntryFileSchema,
  PostBlobDataEntryVoiceMemoSchema,
  PostBlobDataEntryVideoSchema,
  PostBlobDataEntryMusicSchema,
  A2UI.blobEntrySchema,
  MiniAppPostBlobSchema,
  MiniAppActionBlobSchema,
  MiniAppSnapshotBlobSchema,
] as const;

export const PostBlobDataEntrySchema = z.union(postBlobDataEntryDefinitions);

/**
 * An element of the `blob` array on an API resource for a post, used to hold
 * arbitrary off-schema data.
 */
export type PostBlobDataEntry = z.infer<typeof PostBlobDataEntrySchema>;
export type UnknownPostBlobDataEntry = { type: 'unknown' };

function parseRawPostBlobData(blob: string): unknown[] | null {
  try {
    const parsed = JSON.parse(blob);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    logger.trackError('Failed to parse PostBlob data: expected array', {
      blob,
      parsed,
    });
  } catch (error) {
    logger.trackError('Failed to parse PostBlob data', { blob, error });
  }
  return null;
}

export function appendToPostBlob(
  blob: string | undefined,
  entry: PostBlobDataEntry
): string {
  const parsedEntry = PostBlobDataEntrySchema.safeParse(entry);
  if (!parsedEntry.success) {
    logger.trackError('Failed to validate PostBlobDataEntry before append', {
      entry,
      error: parsedEntry.error,
    });
    throw new Error('Invalid PostBlobDataEntry');
  }

  const data: unknown[] = (() => {
    if (!blob) {
      return [];
    }
    const arr = parseRawPostBlobData(blob);
    if (arr) {
      return arr;
    }
    // once we track the error, just start over with an empty blob so we can
    // respect the user's intent to add the file
    return [];
  })();
  data.push(parsedEntry.data);
  return JSON.stringify(data);
}

export function appendFileUploadToPostBlob(
  blob: string | undefined,
  opts: {
    fileUri: string;
    mimeType?: string;
    name?: string;
    /** in bytes */
    size: number;
  }
) {
  return appendToPostBlob(blob, {
    type: 'file',
    version: 1,
    fileUri: opts.fileUri,
    name: opts.name,
    mimeType: opts.mimeType,
    size: opts.size,
  });
}

export function appendVideoToPostBlob(
  blob: string | undefined,
  opts: {
    fileUri: string;
    mimeType?: string;
    name?: string;
    /** in bytes */
    size: number;
    /** in pixels */
    width?: number;
    /** in pixels */
    height?: number;
    /** in seconds */
    duration?: number;
    /** local preview URI (optional in v1) */
    posterUri?: string;
  }
) {
  return appendToPostBlob(blob, {
    type: 'video',
    version: 1,
    fileUri: opts.fileUri,
    name: opts.name,
    mimeType: opts.mimeType,
    size: opts.size,
    width: opts.width,
    height: opts.height,
    duration: opts.duration,
    posterUri: opts.posterUri,
  });
}

export function appendMusicToPostBlob(
  blob: string | undefined,
  entry: PostBlobMusicEntryInput
) {
  return appendToPostBlob(blob, {
    type: 'music',
    version: 1,
    ...entry,
  });
}

export type OpenClawMusicArtistCredit = {
  name: string;
  slug?: string;
  image?: string;
};

export type OpenClawMusicReleaseSummary = {
  publicKey?: string;
  slug?: string;
  title: string;
  artist?: string;
  trackCount?: number;
};

export type OpenClawMusicRelease = {
  publicKey?: string;
  mint?: string;
  slug?: string;
  title: string;
  artist?: string;
  artists?: OpenClawMusicArtistCredit[];
  tags?: string[];
  image?: string;
  audio?: string;
  metadataUri?: string;
  price?: string;
  totalSupply?: string;
  trackCount?: number;
  createdAt?: string;
  createdAtSource?: string;
  symbol?: string;
};

export type OpenClawMusicTrack = {
  type?: 'track';
  stableKey?: string;
  position?: number;
  title: string;
  artist?: string;
  durationSeconds?: number;
  mimeType?: string;
  audio?: string;
  image?: string;
  release?: OpenClawMusicReleaseSummary;
};

export type OpenClawMusicArtist = {
  name: string;
  slug?: string;
  image?: string;
  releaseCount?: number;
  sampleReleases?: OpenClawMusicReleaseSummary[];
};

export type OpenClawMusicSearchResult = {
  source?: string;
  databaseUrl?: string;
  releases?: OpenClawMusicRelease[];
  tracks?: OpenClawMusicTrack[];
  artists?: OpenClawMusicArtist[];
};

export type OpenClawMusicBlobOptions = {
  source?: string;
  provider?: string;
  providerUrl?: string;
};

type OpenClawMusicReleaseBlobOptions = OpenClawMusicBlobOptions & {
  tracks?: OpenClawMusicTrack[];
};

export function musicBlobEntryFromOpenClawRelease(
  release: OpenClawMusicRelease,
  opts: OpenClawMusicReleaseBlobOptions = {}
): PostBlobMusicEntryInput {
  return {
    kind: 'release',
    id: release.publicKey ?? release.slug,
    source: opts.source,
    sourceId: release.publicKey,
    title: release.title,
    artists: openClawArtistCredits(release.artists, release.artist),
    slug: release.slug,
    releasedAt: release.createdAt,
    coverArtUrl: release.image,
    audioUrl: release.audio,
    metadataUri: release.metadataUri,
    tags: release.tags,
    provider: opts.provider,
    providerUrl: opts.providerUrl,
    trackCount: release.trackCount,
    tracks: opts.tracks?.map((track) => openClawTrackData(track, opts)),
    externalIds: musicExternalIds({
      publicKey: release.publicKey,
      mint: release.mint,
      symbol: release.symbol,
      metadataUri: release.metadataUri,
    }),
  };
}

export function musicBlobEntryFromOpenClawTrack(
  track: OpenClawMusicTrack,
  opts: OpenClawMusicBlobOptions = {}
): PostBlobMusicEntryInput {
  const trackData = openClawTrackData(track, opts);

  return {
    kind: 'track',
    ...trackData,
    provider: opts.provider,
    providerUrl: opts.providerUrl,
  };
}

export function musicBlobEntryFromOpenClawArtist(
  artist: OpenClawMusicArtist,
  opts: OpenClawMusicBlobOptions = {}
): PostBlobMusicEntryInput {
  return {
    kind: 'artist',
    id: artist.slug ?? artist.name,
    source: opts.source,
    sourceId: artist.slug,
    title: artist.name,
    artists: openClawArtistCredits([
      { name: artist.name, slug: artist.slug, image: artist.image },
    ]),
    slug: artist.slug,
    coverArtUrl: artist.image,
    provider: opts.provider,
    providerUrl: opts.providerUrl,
    releaseCount: artist.releaseCount,
    sampleReleases: artist.sampleReleases?.map(openClawReleaseSummary),
    externalIds: musicExternalIds({
      slug: artist.slug,
    }),
  };
}

export function musicBlobEntriesFromOpenClawSearchResult(
  result: OpenClawMusicSearchResult,
  opts: OpenClawMusicBlobOptions = {}
): PostBlobMusicEntryInput[] {
  const entryOpts = {
    ...opts,
    source: opts.source ?? result.source,
  };

  return [
    ...(result.releases ?? []).map((release) => {
      const matchingTracks = (result.tracks ?? []).filter((track) =>
        openClawTrackBelongsToRelease(track, release)
      );
      return musicBlobEntryFromOpenClawRelease(release, {
        ...entryOpts,
        tracks: matchingTracks,
      });
    }),
    ...(result.tracks ?? []).map((track) =>
      musicBlobEntryFromOpenClawTrack(track, entryOpts)
    ),
    ...(result.artists ?? []).map((artist) =>
      musicBlobEntryFromOpenClawArtist(artist, entryOpts)
    ),
  ];
}

function openClawTrackData(
  track: OpenClawMusicTrack,
  opts: OpenClawMusicBlobOptions = {}
): PostBlobMusicTrack {
  return {
    id: track.stableKey,
    source: opts.source,
    sourceId: track.stableKey,
    title: track.title,
    artists: openClawArtistCredits(undefined, track.artist),
    releaseId: track.release?.publicKey,
    releaseSlug: track.release?.slug,
    releaseTitle: track.release?.title,
    duration: track.durationSeconds,
    coverArtUrl: track.image,
    audioUrl: track.audio,
    mimeType: track.mimeType,
    trackNumber: track.position,
    externalIds: musicExternalIds({
      stableKey: track.stableKey,
      releasePublicKey: track.release?.publicKey,
    }),
  };
}

function openClawTrackBelongsToRelease(
  track: OpenClawMusicTrack,
  release: OpenClawMusicRelease
): boolean {
  if (release.publicKey && track.release?.publicKey === release.publicKey) {
    return true;
  }
  if (
    release.publicKey &&
    track.stableKey?.startsWith(`${release.publicKey}:`)
  ) {
    return true;
  }
  if (release.slug && track.release?.slug === release.slug) {
    return true;
  }
  return !!release.title && track.release?.title === release.title;
}

function openClawArtistCredits(
  artists?: OpenClawMusicArtistCredit[],
  fallbackName?: string
): PostBlobMusicArtistCredit[] | undefined {
  const credits =
    artists && artists.length > 0
      ? artists.map((artist) => ({
          name: artist.name,
          slug: artist.slug,
          imageUrl: artist.image,
          externalIds: musicExternalIds({ slug: artist.slug }),
        }))
      : fallbackName
        ? [{ name: fallbackName }]
        : [];

  return credits.length > 0 ? credits : undefined;
}

function openClawReleaseSummary(
  release: OpenClawMusicReleaseSummary
): NonNullable<PostBlobDataEntryMusic['sampleReleases']>[number] {
  return {
    id: release.publicKey ?? release.slug,
    sourceId: release.publicKey,
    title: release.title,
    artist: release.artist,
    slug: release.slug,
    trackCount: release.trackCount,
    externalIds: musicExternalIds({ publicKey: release.publicKey }),
  };
}

function musicExternalIds(
  ids: Record<string, string | undefined>
): Record<string, string> | undefined {
  const entries = Object.entries(ids).filter(
    (entry): entry is [string, string] => !!entry[1]
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Client-side parsed representation of PostBlob data */
export type ClientPostBlobData = Array<
  PostBlobDataEntry | UnknownPostBlobDataEntry
>;

export function parsePostBlob(blob: string): ClientPostBlobData {
  const arr = parseRawPostBlobData(blob);
  if (!arr) {
    return [{ type: 'unknown' }];
  }

  return safeParseArrayWithFallback(
    PostBlobDataEntrySchema,
    (entry) => {
      logger.trackError('Failed to parse PostBlobDataEntry', { entry });
      return { type: 'unknown' } as const;
    },
    arr
  );
}

export function getMiniAppPostBlob(
  blob: string | null | undefined
): MiniAppPostBlob | null {
  if (!blob) {
    return null;
  }

  return (
    parsePostBlob(blob).find(
      (entry): entry is MiniAppPostBlob => entry.type === 'tlon-mini-app'
    ) ?? null
  );
}

export function getMiniAppActionBlobs(
  blob: string | null | undefined
): MiniAppActionBlob[] {
  if (!blob) {
    return [];
  }

  return parsePostBlob(blob).filter(
    (entry): entry is MiniAppActionBlob => entry.type === 'tlon-mini-app-action'
  );
}

export function getMiniAppSnapshotBlobs(
  blob: string | null | undefined
): MiniAppSnapshotBlob[] {
  if (!blob) {
    return [];
  }

  return parsePostBlob(blob).filter(
    (entry): entry is MiniAppSnapshotBlob =>
      entry.type === 'tlon-mini-app-snapshot'
  );
}

export function getOnlyMiniAppActionBlob(
  blob: string | null | undefined
): MiniAppActionBlob | null {
  if (!blob) {
    return null;
  }

  const parsed = parsePostBlob(blob);
  return parsed.length === 1 && parsed[0]?.type === 'tlon-mini-app-action'
    ? parsed[0]
    : null;
}

export function getOnlyMiniAppSnapshotBlob(
  blob: string | null | undefined
): MiniAppSnapshotBlob | null {
  if (!blob) {
    return null;
  }

  const parsed = parsePostBlob(blob);
  return parsed.length === 1 && parsed[0]?.type === 'tlon-mini-app-snapshot'
    ? parsed[0]
    : null;
}

export function toPostData({
  attachments,
  content,
  image,
  channelType,
  title,
}: {
  content: (Inline | Block)[];
  attachments: FinalizedAttachment[];
  channelType: ChannelType;
  title?: string;
  image?: string;
}): { story: Story; metadata: PostMetadata; blob?: string } {
  const blocks: Block[] = [];
  let blob: string | undefined = undefined;

  attachments
    // For notebooks, skip header image - it goes in metadata only, not content
    .filter((attachment) => {
      if (channelType === 'notebook' && image && attachment.type === 'image') {
        return attachment.file.uri !== image;
      }
      return true;
    })
    .forEach((attachment) => {
      switch (attachment.type) {
        case 'reference': {
          const block = createReferenceBlock(attachment);
          if (block) {
            blocks.push(block);
          }
          break;
        }

        case 'image': {
          blocks.push(createImageBlock(attachment));
          break;
        }

        case 'link': {
          blocks.push(createLinkBlock(attachment));
          break;
        }

        case 'file': {
          const name =
            attachment.name ??
            (attachment.localFile instanceof File
              ? attachment.localFile.name
              : filenameFromPath(attachment.localFile, {
                  decodeURI: true,
                })) ??
            undefined;
          blob = appendFileUploadToPostBlob(blob, {
            fileUri: UploadedFileAttachment.uri(attachment),
            name,
            mimeType: attachment.mimeType,
            size: attachment.size,
          });
          break;
        }

        case 'voicememo': {
          blob = appendToPostBlob(blob, {
            type: 'voicememo',
            version: 1,
            fileUri: uploadStateUri(attachment.uploadState),
            size: attachment.size,
            transcription: attachment.transcription,
            waveformPreview: attachment.waveformPreview,
            duration: attachment.duration,
          });
          break;
        }

        case 'video': {
          const name =
            attachment.name ??
            (attachment.localFile instanceof File
              ? attachment.localFile.name
              : filenameFromPath(attachment.localFile, { decodeURI: true })) ??
            undefined;
          blob = appendVideoToPostBlob(blob, {
            fileUri: UploadedVideoAttachment.uri(attachment),
            name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            width: attachment.width,
            height: attachment.height,
            duration: attachment.duration,
            posterUri: attachment.posterUri,
          });
          break;
        }
      }
    });

  const story = constructStory(content);

  if (blocks && blocks.length > 0) {
    if (channelType === 'chat') {
      story.unshift(...blocks.map((block) => ({ block })));
    } else {
      story.push(...blocks.map((block) => ({ block })));
    }
  }

  const metadata: PostMetadata = { title };

  if (image) {
    // HACK: `draft.image` is a URI string, which might be local (e.g. `file://`).
    // We want to set `metadata.image` to a web-accessible URI, so if it's local,
    // find the corresponding finalized attachment to get the web-accessible URI.
    //
    // (We could do this unconditionally, but we omit *some* images from
    // `attachments` for historical reasons - in these cases, we won't be able
    // to find the finalized attachment. If we are omitting an attachment, it's
    // likely because the image is already uploaded -> `draft.image` is already
    // a web-accessible URI. If `draft.image` is web-accessible, we can just
    // use it directly.)
    const localPrefixes = ['file:', 'blob:', 'data:', 'content:'];
    const isLocal = localPrefixes.some((prefix) => image.startsWith(prefix));

    if (isLocal) {
      const attachment = attachments.find(
        (a): a is UploadedImageAttachment =>
          a.type === 'image' && a.file.uri === image
      );
      if (!attachment) {
        throw new Error('unable to attach image');
      }
      metadata.image =
        attachment.uploadState.status === 'success'
          ? attachment.uploadState.remoteUri
          : attachment.uploadState.localUri;
    } else {
      metadata.image = image;
    }
  } else {
    metadata.image = null;
  }

  return { story, metadata, blob };
}

function createImageBlock(attachment: UploadedImageAttachment): Block {
  return {
    image: {
      src:
        attachment.uploadState.status === 'success'
          ? attachment.uploadState.remoteUri
          : attachment.uploadState.localUri,
      height: attachment.file.height,
      width: attachment.file.width,
      alt: 'image',
    },
  };
}

function createLinkBlock(attachment: LinkAttachment): Block {
  if (attachment.type !== 'link') {
    throw new Error('createLinkBlock called with non-link attachment');
  }
  return {
    link: {
      url: attachment.url,
      meta: {
        siteIconUrl: attachment.siteIconUrl,
        siteName: attachment.siteName,
        title: attachment.title,
        author: attachment.author,
        description: attachment.description,
        previewImageUrl: attachment.previewImageUrl,
        previewImageHeight: attachment.previewImageHeight,
        previewImageWidth: attachment.previewImageWidth,
      },
    },
  };
}

function createReferenceBlock(
  attachment: ReferenceAttachment
): Block | undefined {
  const cite = pathToCite(attachment.path);
  return cite ? { cite } : undefined;
}
