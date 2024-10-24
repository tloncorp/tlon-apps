import { makeMention, makeParagraph, makeText } from '@tloncorp/shared';
import { JSONContent } from '@tloncorp/shared/dist/urbit';

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

const urlRegex =
  /(^|[^\w\s])((https?:\/\/|www\.)[^\s,?!.]+(?:[.][^\s,?!.]+)*(?:[^\s,?!.])*)([,?!.])?/;

const isUrl = (text: string): boolean => {
  return urlRegex.test(text);
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

const processLine = (line: string, mentions: Mention[]): JSONContent => {
  const parsedContent: JSONContent[] = [];
  let isBolding = false;
  let isItalicizing = false;
  let isCoding = false;
  line.split(' ').forEach((word) => {
    const marks = [];
    const mention = mentions.find((mention) => mention.display === word);
    if (mention) {
      parsedContent.push(makeMention(mention.id));
      parsedContent.push(makeText(' '));
      return;
    }

    if (isUrl(word)) {
      const match = urlRegex.exec(word);
      if (match) {
        const [_, precedingChar, url, , followingChar] = match;

        if (precedingChar && precedingChar !== '') {
          parsedContent.push(makeText(precedingChar));
        }

        parsedContent.push({
          type: 'text',
          text: url,
          marks: [
            {
              type: 'link',
              attrs: {
                href: url,
              },
            },
          ],
        });

        if (followingChar) {
          parsedContent.push(makeText(followingChar));
        }

        parsedContent.push(makeText(' '));
        return;
      }
    }

    if (isCodeStart(word)) {
      isCoding = true;
      word = word.slice(1);
    }

    if (isCoding) {
      marks.push({ type: 'code' });
      if (isCodeEnd(word)) {
        isCoding = false;
        word = word.slice(0, -1);
      }

      parsedContent.push({
        ...makeText(word),
        marks,
      });

      parsedContent.push(makeText(' '));
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
        word = word.slice(0, -2);
      }
    }

    if (isItalicizing) {
      marks.push({ type: 'italics' });
      if (isItalicEnd(word)) {
        isItalicizing = false;
        word = word.slice(0, -1);
      }
    }

    if (marks.length > 0) {
      parsedContent.push({
        ...makeText(word),
        marks,
      });
    } else {
      parsedContent.push(makeText(word));
    }

    parsedContent.push(makeText(' '));
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

  content.forEach((node) => {
    if (node.type === 'paragraph') {
      if (!node.content) {
        return;
      }
      node.content.forEach((child) => {
        if (child.type === 'text') {
          if (!child.text) {
            return;
          }
          text.push(child.text);
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
      text.push('\n');
    } else if (node.type === 'codeBlock') {
      if (!node.content || !node.content[0].text) {
        return;
      }
      text.push('```\n');
      text.push(node.content[0].text);
      text.push('\n```\n');
    }
  });

  return {
    text: text.join(''),
    mentions,
  };
}
