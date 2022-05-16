import React from 'react';
import { useNavigate } from 'react-router';
import { useChannelFlag } from '../../hooks';
import { useRouteGroup } from '../../state/groups';
import { useChatState } from '../../state/chat';
import { ChatWhom, ChatWrit } from '../../types/chat';
import IconButton from '../IconButton';
import BubbleIcon from '../icons/BubbleIcon';
import ElipsisIcon from '../icons/ElipsisIcon';
import FaceIcon from '../icons/FaceIcon';
import HashIcon from '../icons/HashIcon';
import ShareIcon from '../icons/ShareIcon';
import XIcon from '../icons/XIcon';

export default function ChatMessageOptions(props: {
  whom: string;
  writ: ChatWrit;
}) {
  const { whom, writ } = props;
  const groupFlag = useRouteGroup();
  const onDelete = () => {
    useChatState.getState().delMessage(whom, writ.seal.id);
  };

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
            action={() => console.log('reply')}
          />
          <IconButton
            icon={<HashIcon className="text-gray-400" />}
            label="Start Thread"
            showTooltip
            action={() =>
              navigate(
                `/groups/${groupFlag}/channels/chat/${whom}/message/${writ.seal.time}`
              )
            }
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
