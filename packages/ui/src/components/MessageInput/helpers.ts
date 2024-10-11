import { EditorBridge } from '@10play/tentap-editor';
import { Editor } from '@tiptap/react';
import { createDevLogger, tiptap } from '@tloncorp/shared/dist';
import {
  Block,
  Inline,
  JSONContent,
  constructStory,
  isInline,
} from '@tloncorp/shared/dist/urbit';

import { Attachment } from '../../contexts';

const logger = createDevLogger('processReference', true);

export async function processReferenceAndUpdateEditor({
  editor,
  editorJson,
  pastedText,
  matchRegex,
  processMatch,
}: {
  editorJson: JSONContent;
  editor: EditorBridge | Editor;
  pastedText: string;
  matchRegex: RegExp;
  processMatch: (match: string) => Promise<Attachment | null>;
}): Promise<Attachment | null> {
  try {
    logger.log('checking against', matchRegex);
    const match = pastedText.match(matchRegex);

    if (match) {
      logger.log('found match', match[0]);
      const attachment = processMatch(match[0]);

      if (attachment) {
        logger.log('extracted attachment', attachment);

        // remove the attachments corresponding text from the editor
        const filteredJson = filterRegexFromJson(editorJson, matchRegex);

        logger.log(`updating editor`, filteredJson);
        if ('setContent' in editor) {
          // EditorBridge native case
          // @ts-expect-error setContent does accept JSONContent
          editor.setContent(filteredJson);
        } else if ('commands' in editor) {
          // Editor web case
          editor.commands.setContent(filteredJson);
        } else {
          logger.error('Unknown editor type');
        }

        return attachment;
      }
    }
  } catch (e) {
    logger.error('error processing reference', e);
  }

  return null;
}

// check editor JSON for text or link matches and remove them
function filterRegexFromJson(initialJson: object, matchRegex: RegExp): object {
  const allContent = tiptap.JSONToInlines(initialJson);

  const filteredContent = allContent
    .map((content) => {
      if (typeof content === 'string') {
        return content.replace(matchRegex, '');
      } else if (isInline(content) && 'link' in content) {
        if (content.link?.href && content.link?.href.match(matchRegex)) {
          return null;
        }
      }
      return content;
    })
    .filter((content) => content !== null && content !== '') as (
    | Inline
    | Block
  )[];

  const filteredInlines = filteredContent.filter(
    (c) => typeof c === 'string' || (typeof c === 'object' && isInline(c))
  ) as Inline[];

  const filteredBlocks = (filteredContent.filter(
    (c) => typeof c !== 'string' && 'block' in c
  ) || []) as unknown as Block[];

  // it looks like construct story can handle blocks. Do we have to push them separately?
  const newStory = constructStory(filteredInlines);

  if (filteredBlocks && filteredBlocks.length > 0) {
    newStory.push(
      ...filteredBlocks.map((block) => ({
        block: block,
      }))
    );
  }

  const newJson = tiptap.diaryMixedToJSON(newStory);

  return newJson;
}
