import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useChatState } from '../../state/chat';
import { ChatWrit } from '../../types/chat';
import IconButton from '../../components/IconButton';
import BubbleIcon from '../../components/icons/BubbleIcon';
import EllipsisIcon from '../../components/icons/EllipsisIcon';
import FaceIcon from '../../components/icons/FaceIcon';
import HashIcon from '../../components/icons/HashIcon';
import ShareIcon from '../../components/icons/ShareIcon';
import XIcon from '../../components/icons/XIcon';
import { useChatStore } from '../useChatStore';

export default function ChatMessageOptions(props: {
  whom: string;
  writ: ChatWrit;
}) {
  const { whom, writ } = props;
  const onDelete = () => {
    useChatState.getState().delMessage(whom, writ.seal.id);
  };

  const reply = useCallback(() => {
    useChatStore.getState().reply(whom, writ.seal.id);
  }, [writ, whom]);

  const navigate = useNavigate();
  return (
    <div className="absolute right-2 -top-5 z-10 flex flex space-x-0.5 rounded-lg border border-gray-100 bg-white p-[1px] align-middle opacity-0 group-one-hover:opacity-100">
      <IconButton
        icon={<FaceIcon className="h-6 w-6 text-gray-400" />}
        label="React"
        showTooltip
        action={() => console.log('react')}
      />
      {!writ.memo.replying ? (
        <>
          <IconButton
            icon={<BubbleIcon className="h-6 w-6 text-gray-400" />}
            label="Reply"
            showTooltip
            action={reply}
          />
          <IconButton
            icon={<HashIcon className="h-6 w-6 text-gray-400" />}
            label="Start Thread"
            showTooltip
            action={() => navigate(`message/${writ.seal.id}`)}
          />
        </>
      ) : null}
      <IconButton
        icon={<ShareIcon className="h-6 w-6 text-gray-400" />}
        label="Send to..."
        showTooltip
        action={() => console.log('send to..')}
      />
      {window.our === writ.memo.author ? (
        <IconButton
          icon={<XIcon className="h-6 w-6 text-red" />}
          label="Delete"
          showTooltip
          action={onDelete}
        />
      ) : null}

      <IconButton
        icon={<EllipsisIcon className="h-6 w-6 text-gray-400" />}
        label="More..."
        showTooltip
        action={() => console.log('More...')}
      />
    </div>
  );
}
