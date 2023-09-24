import { CacheId } from '@/state/channel/channel';
import {
  Block,
  Cite,
  constructStory,
  Nest,
  NoteEssay,
  Story,
} from '@/types/channel';
import { JSONContent } from '@tiptap/core';
import { JSONToInlines } from './tiptap';
import { isImageUrl } from './utils';

interface MessageSender {
  whom: string;
  replying?: string;
  editorJson: JSONContent;
  replyCite?: Cite;
  blocks: Block[];
  text: string;
  now: number;
  sendDm?: (whom: string, essay: NoteEssay, replying?: string) => void;
  sendChatMessage?: ({
    cacheId,
    essay,
  }: {
    cacheId: CacheId;
    essay: NoteEssay;
  }) => void;
  sendQuip?: ({
    nest,
    noteId,
    content,
  }: {
    nest: Nest;
    noteId: string;
    content: Story;
  }) => void;
}

export default function messageSender({
  whom,
  replying,
  editorJson,
  replyCite,
  blocks,
  text,
  now,
  sendDm,
  sendChatMessage,
  sendQuip,
}: MessageSender) {
  const data = JSONToInlines(editorJson);
  const noteContent = constructStory(data);
  if (blocks.length > 0) {
    noteContent.push(
      ...blocks.map((b) => ({
        block: b,
      }))
    );
  }

  if (replyCite) {
    noteContent.unshift({ block: { cite: replyCite } });
  }

  // Checking for this prevents an extra <br>
  // from being added to the end of the message
  // const dataIsJustBreak =
  // data.length === 1 && typeof data[0] === 'object' && 'break' in data[0];

  const essay: NoteEssay = {
    'han-data': {
      chat: null,
    },
    author: `~${window.ship || 'zod'}`,
    sent: now,
    content: noteContent,
  };

  const textIsImageUrl = isImageUrl(text);
  const dataIsJustLink =
    data.length > 0 && typeof data[0] === 'object' && 'link' in data[0];
  const cacheId = {
    sent: now,
    author: window.our,
  };

  if (textIsImageUrl && dataIsJustLink) {
    const url = text;
    const name = 'chat-image';

    const img = new Image();
    img.src = url;

    img.onload = () => {
      const { width, height } = img;
      const content = [
        {
          block: {
            image: {
              src: url,
              alt: name,
              width,
              height,
            },
          },
        },
      ];

      if (sendDm) {
        sendDm(
          whom,
          {
            ...essay,
            content,
          },
          replying
        );
      } else if (sendChatMessage) {
        sendChatMessage({
          cacheId,
          essay: {
            ...essay,
            content,
          },
        });
      } else if (sendQuip && replying) {
        sendQuip({
          nest: `chat/${whom}`,
          noteId: replying,
          content,
        });
      }

      img.onerror = () => {
        if (sendDm) {
          sendDm(whom, essay, replying);
        } else if (sendChatMessage) {
          sendChatMessage({
            cacheId,
            essay,
          });
        } else if (sendQuip && replying) {
          sendQuip({
            nest: `chat/${whom}`,
            noteId: replying,
            content: essay.content,
          });
        }
      };
    };
  } else if (sendDm) {
    sendDm(whom, essay, replying);
  } else if (sendChatMessage) {
    sendChatMessage({
      cacheId,
      essay,
    });
  } else if (sendQuip && replying) {
    sendQuip({
      nest: `chat/${whom}`,
      noteId: replying,
      content: essay.content,
    });
  }
}
