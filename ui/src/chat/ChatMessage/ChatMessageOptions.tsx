import React, { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useRouteGroup } from '../../state/groups';
import { useChatState } from '../../state/chat';
import { ChatWhom, ChatWrit } from '../../types/chat';
import IconButton from '../../components/IconButton';
import BubbleIcon from '../../components/icons/BubbleIcon';
import ElipsisIcon from '../../components/icons/ElipsisIcon';
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
  const groupFlag = useRouteGroup();
  const onDelete = () => {
    useChatState.getState().delMessage(whom, writ.seal.id);
  };

  const reply = useCallback(() => {
    useChatStore.getState().reply(whom, writ.seal.id);
  }, [writ, whom]);

  const navigate = useNavigate();
  return (
    <div className="absolute right-2 -top-5 z-10 flex flex space-x-[2px] rounded-md border-[1px] border-gray-100 bg-white p-[2px] align-middle opacity-0 group-one-hover:opacity-100">
      <IconButton
        icon={<FaceIcon className="text-gray-400" />}
        label="React"
        showTooltip
        action={() => console.log('react')}
      />
      {!writ.memo.replying ? (
        <>
          <IconButton
            icon={<BubbleIcon className="text-gray-400" />}
            label="Reply"
            showTooltip
            action={reply}
          />
          <IconButton
            icon={<HashIcon className="text-gray-400" />}
            label="Start Thread"
            showTooltip
            action={() => navigate(`message/${writ.seal.id}`)}
          />
        </>
      ) : null}
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
