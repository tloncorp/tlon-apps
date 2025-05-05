import { makeMention, makeParagraph, makeText } from '@tloncorp/shared';
import { JSONContent } from '@tloncorp/shared/urbit';
import isURL from 'validator/lib/isURL';

import { Mention } from './useMentions';

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
  return text.endsWith('`');
};

const isUrl = (text: string): boolean => {
  return isURL(text);
};

function areMarksEqual(marks1: any[] = [], marks2: any[] = []): boolean {
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

interface TextNode {
  type: 'text';
  text: string;
}

interface MentionNode {
  type: 'mention';
  mention: Mention;
}

type LineNode = TextNode | MentionNode;

const processLine = (line: string, mentions: Mention[]): JSONContent => {
  const parsedContent: JSONContent[] = [];
  let isBolding = false;
  let isItalicizing = false;
  let isCoding = false;
  let isEndOfFormatting = false;

  if (line.startsWith('> ')) {
    const quotedContent = processLine(line.slice(2), mentions);
    return {
      type: 'blockquote',
      content: [quotedContent],
    };
  }

  let segments: LineNode[] =
    mentions.length === 0
      ? line.split(' ').map((word) => ({ type: 'text', text: word }))
      : [];
  let index = 0;
  for (const [i, mention] of mentions.entries()) {
    const nextSegment = line.slice(index, Math.max(mention.start - 1, 0));
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
      const lastSegment = line.slice(index);
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
        word = word.slice(0, -1);
      }

      parsedContent.push({
        ...makeText(word),
        marks,
      });

      if (isEndOfFormatting) {
        parsedContent.push(makeText(' '));
        isEndOfFormatting = false;
        return;
      }
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

function processTextLines(lines: string[], mentions: Mention[]): JSONContent[] {
  return lines.map((line) => processLine(line.trim(), mentions));
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
  let currentLines: string[] = [];
  let inCodeBlock = false;
  let currentCodeBlock: string[] = [];
  const language = 'plaintext';

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentLines.length > 0) {
          content.push(...processTextLines(currentLines, mentions));
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
              text: currentCodeBlock.join('\n'),
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
          text: currentCodeBlock.join('\n'),
        },
      ],
      attrs: {
        language,
      },
    });
  }

  if (currentLines.length > 0) {
    content.push(...processTextLines(currentLines, mentions));
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
