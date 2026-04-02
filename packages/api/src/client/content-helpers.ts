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

const postBlobDataEntryDefinitions = [
  PostBlobDataEntryFileSchema,
  PostBlobDataEntryVoiceMemoSchema,
  PostBlobDataEntryVideoSchema,
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
    .filter((attachment) => attachment.type !== 'text')
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
