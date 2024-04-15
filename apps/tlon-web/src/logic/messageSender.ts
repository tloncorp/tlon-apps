import { JSONContent } from '@tiptap/core';
import {
  Block,
  CacheId,
  Cite,
  Memo,
  Nest,
  PostEssay,
  constructStory,
} from '@tloncorp/shared/dist/urbit/channel';

import { SendMessageVariables, SendReplyVariables } from '@/state/chat';
import { buildAddDelta, createMessage } from '@/state/chat/utils';

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
  sendDm?: (variables: SendMessageVariables) => void;
  sendDmReply?: (variables: SendReplyVariables) => void;
  sendChatMessage?: ({
    cacheId,
    essay,
  }: {
    cacheId: CacheId;
    essay: PostEssay;
  }) => void;
  sendReply?: ({
    nest,
    postId,
    memo,
    cacheId,
  }: {
    nest: Nest;
    postId: string;
    memo: Memo;
    cacheId: CacheId;
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
  sendDmReply,
  sendChatMessage,
  sendReply,
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

  const essay: PostEssay = {
    'kind-data': {
      chat: null,
    },
    author: `~${window.ship || 'zod'}`,
    sent: now,
    content: noteContent,
  };

  const memo: Memo = {
    content: noteContent,
    author: `~${window.ship || 'zod'}`,
    sent: now,
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
      const message = createMessage(whom, { ...essay, content }, replying);

      if (sendDm) {
        sendDm({
          whom,
          delta: buildAddDelta({ ...essay, content }),
        });
      } else if (sendDmReply && replying) {
        sendDmReply({
          whom,
          message,
          parentId: replying,
        });
      } else if (sendChatMessage) {
        sendChatMessage({
          cacheId,
          essay: {
            ...essay,
            content,
          },
        });
      } else if (sendReply && replying) {
        sendReply({
          nest: `chat/${whom}`,
          postId: replying,
          memo: {
            ...memo,
            content,
          },
          cacheId,
        });
      }

      img.onerror = () => {
        if (sendDm) {
          sendDm({ whom, delta: buildAddDelta(essay) });
        } else if (sendDmReply && replying) {
          sendDmReply({
            whom,
            message,
            parentId: replying,
          });
        } else if (sendChatMessage) {
          sendChatMessage({
            cacheId,
            essay,
          });
        } else if (sendReply && replying) {
          sendReply({
            nest: `chat/${whom}`,
            postId: replying,
            memo,
            cacheId,
          });
        }
      };
    };
  } else if (sendDm) {
    sendDm({ whom, delta: buildAddDelta(essay) });
  } else if (sendDmReply && replying) {
    const message = createMessage(whom, essay, replying);
    sendDmReply({
      whom,
      message,
      parentId: replying,
    });
  } else if (sendChatMessage) {
    sendChatMessage({
      cacheId,
      essay,
    });
  } else if (sendReply && replying) {
    sendReply({
      nest: `chat/${whom}`,
      postId: replying,
      memo,
      cacheId,
    });
  }
}
