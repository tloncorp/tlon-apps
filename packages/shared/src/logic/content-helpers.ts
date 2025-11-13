import isURL from 'validator/lib/isURL';

import { ChannelType, PostMetadata } from '../db';
import {
  FinalizedAttachment,
  LinkAttachment,
  ReferenceAttachment,
  UploadedImageAttachment,
} from '../domain';
import {
  Block,
  Inline,
  JSONContent,
  Story,
  constructStory,
  pathToCite,
} from '../urbit';
import { makeMention, makeParagraph, makeText } from './tiptap';

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
    const nextSegment = text.slice(index, Math.max(mention.start - 1, 0));
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

    index = mention.end + 1;

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
      parsedContent.push(makeText(' '));
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

          text.push(`~${child.attrs.id}`);

          const mentionStartIndex = text.join('').lastIndexOf('~');
          const mentionEndIndex = mentionStartIndex + child.attrs.id.length + 1;

          mentions.push({
            id: child.attrs!.id,
            display: `~${child.attrs!.id}`,
            start: mentionStartIndex,
            end: mentionEndIndex,
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

type PostBlobData = { fileUri: string }[];

export function appendFileUploadToPostBlob(
  blob: string | undefined,
  fileUri: string
) {
  // TODO: saner encoding
  const data: PostBlobData = (() => {
    if (!blob) {
      return [];
    }
    try {
      const arr: PostBlobData = JSON.parse(blob);
      if (Array.isArray(arr)) {
        return arr;
      }
    } catch {
      // swallow parse error
    }
    return [];
  })();
  data.push({ fileUri });
  return JSON.stringify(data);
}

export function parsePostBlob(blob: string): PostBlobData {
  try {
    const arr: PostBlobData = JSON.parse(blob);
    if (Array.isArray(arr)) {
      // This looks like an identity, but it's actually a very bad way to
      // validate the PostBlobData.
      return arr.map(({ fileUri }) => ({ fileUri }));
    }
  } catch {
    // swallow parse error
  }
  return [];
}

export function toPostData({
  attachments,
  content,
  image,
  channelType,
  isEdit,
  title,
}: {
  content: (Inline | Block)[];
  attachments: FinalizedAttachment[];
  channelType: ChannelType;
  title?: string;
  image?: string;
  isEdit?: boolean;
}): { story: Story; metadata: PostMetadata; blob?: string } {
  const blocks: Block[] = [];
  let blob: string | undefined = undefined;

  attachments
    .filter((attachment) => attachment.type !== 'text')
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
          if (
            !image ||
            attachment.file.uri !== image ||
            (attachment.file.uri === image &&
              isEdit &&
              channelType === 'gallery')
          ) {
            blocks.push(createImageBlock(attachment));
          }
          break;
        }

        case 'link': {
          blocks.push(createLinkBlock(attachment));
          break;
        }

        case 'file': {
          if (attachment.uploadState.status === 'success') {
            blob = appendFileUploadToPostBlob(
              blob,
              attachment.uploadState.remoteUri
            );
          } else if (attachment.uploadState.status === 'uploading') {
            // necessary for optimistic preview
            blob = appendFileUploadToPostBlob(
              blob,
              attachment.uploadState.localUri
            );
          }
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
