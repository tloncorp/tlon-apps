import React from 'react';
import { useNavigate } from 'react-router';
import { useChatState } from '../state/chat';

interface DmInviteProps {
  ship: string;
}

export default function DmInvite({ ship }: DmInviteProps) {
  const navigate = useNavigate();
  const onAccept = () => {
    useChatState.getState().dmRsvp(ship, true);
  };
  const onDecline = () => {
    navigate(-1);
    useChatState.getState().dmRsvp(ship, false);
  };
  return (
    <div className="flex flex-col">
      <div className="flex">
        <button onClick={onDecline} type="button">
          Decline
        </button>
        <button onClick={onAccept} type="button">
          Accept
        </button>
      </div>
    </div>
  );
}
