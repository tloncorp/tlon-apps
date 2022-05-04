import React from 'react';
import IconButton from '../IconButton';
import BubbleIcon from '../icons/BubbleIcon';
import ElipsisIcon from '../icons/ElipsisIcon';
import FaceIcon from '../icons/FaceIcon';
import HashIcon from '../icons/HashIcon';
import ShareIcon from '../icons/ShareIcon';

export default function ChatMessageOptions() {
  return (
    <div className="z-1 absolute right-2 -top-7 flex rounded-md border-[1px] border-gray-100 bg-white p-2 align-middle opacity-0 group-one-hover:opacity-100">
      <IconButton
        icon={<FaceIcon />}
        label="React"
        action={() => console.log('react')}
      />
      <IconButton
        icon={<BubbleIcon />}
        label="Reply"
        action={() => console.log('reply')}
      />
      <IconButton
        icon={<HashIcon />}
        label="Start Thread"
        action={() => console.log('start thread')}
      />
      <IconButton
        icon={<ShareIcon />}
        label="Send to..."
        action={() => console.log('send to..')}
      />
      <IconButton
        icon={<ElipsisIcon />}
        label="More..."
        action={() => console.log('More...')}
      />
    </div>
  );
}
