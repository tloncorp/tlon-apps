import React from 'react';
import { useNavigate } from 'react-router';
import Avatar from '../components/Avatar';
import { useChatState } from '../state/chat';
import { useContact } from '../state/contact';

interface DmInviteProps {
  ship: string;
}

export default function DmInvite({ ship }: DmInviteProps) {
  const navigate = useNavigate();
  const contact = useContact(ship);
  const onAccept = () => {
    useChatState.getState().dmRsvp(ship, true);
  };
  const onDecline = () => {
    navigate(-1);
    useChatState.getState().dmRsvp(ship, false);
  };
  return (
    <div className="flex h-full w-full flex-col flex-col items-center space-y-4 pt-8">
      <div className="flex flex-col items-center space-y-1">
        <Avatar ship={ship} size="huge" icon={false} />
        {contact?.nickname ? (
          <span className="font-semibold">{contact.nickname}</span>
        ) : null}
        <span className="text-gray-600">{ship}</span>
        {/*
          TODO: Show mutual groups.
         */}
      </div>
      <span className="font-semibold">
        {contact?.nickname ? contact.nickname : ship} is sending you a new
        message
      </span>
      <div className="flex space-x-2">
        <button className="button" onClick={onAccept} type="button">
          Accept
        </button>
        <button className="button" onClick={onDecline} type="button">
          Decline
        </button>
      </div>
    </div>
  );
}
