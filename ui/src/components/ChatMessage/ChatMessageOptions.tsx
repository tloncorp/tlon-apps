import React from 'react';
import { useChatState } from '../../state/chat';
import { ChatWrit } from '../../types/chat';
import IconButton from '../IconButton';
import BubbleIcon from '../icons/BubbleIcon';
import ElipsisIcon from '../icons/ElipsisIcon';
import FaceIcon from '../icons/FaceIcon';
import HashIcon from '../icons/HashIcon';
import ShareIcon from '../icons/ShareIcon';
import XIcon from '../icons/XIcon';

export default function ChatMessageOptions(props: {
  flag: string;
  writ: ChatWrit;
}) {
  const { flag, writ } = props;
  const onDelete = () => {
    useChatState.getState().delMessage(flag, writ.seal.time);
  };

  return (
    <div className="z-1 absolute right-2 -top-5 flex flex space-x-[2px] rounded-md border-[1px] border-gray-100 bg-white p-[2px] align-middle opacity-0 group-one-hover:opacity-100">
      <IconButton
        icon={<FaceIcon className="text-gray-400" />}
        label="React"
        showTooltip
        action={() => console.log('react')}
      />
      <IconButton
        icon={<BubbleIcon className="text-gray-400" />}
        label="Reply"
        showTooltip
        action={() => console.log('reply')}
      />
      <IconButton
        icon={<HashIcon className="text-gray-400" />}
        label="Start Thread"
        showTooltip
        action={() => console.log('start thread')}
      />
      <IconButton
        icon={<ShareIcon className="text-gray-400" />}
        label="Send to..."
        showTooltip
        action={() => console.log('send to..')}
      />
      {window.our === writ.memo.author ? (
        <IconButton
          icon={<XIcon className="text-red" />}
          label="Delete"
          showTooltip
          action={onDelete}
        />
      ) : null}

      <IconButton
        icon={<ElipsisIcon className="text-gray-400" />}
        label="More..."
        showTooltip
        action={() => console.log('More...')}
      />
    </div>
  );
}
