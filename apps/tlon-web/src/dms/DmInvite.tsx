import React, { useState } from 'react';
import { useNavigate } from 'react-router';

import { useDmRsvpMutation } from '@/state/chat';

import X16Icon from '../components/icons/X16Icon';
import { useContact } from '../state/contact';
import DMHero from './DMHero';

interface DmInviteProps {
  ship: string;
}

export default function DmInvite({ ship }: DmInviteProps) {
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const navigate = useNavigate();
  const contact = useContact(ship);
  const { mutateAsync: dmRsvp } = useDmRsvpMutation();
  const onAccept = async () => {
    await dmRsvp({ ship, accept: true });
  };
  const onDecline = async () => {
    navigate(-1);
    await dmRsvp({ ship, accept: false });
  };
  return (
    <div className="relative flex h-full w-full">
      <div className="flex h-full w-full flex-col items-center space-y-4 pt-8">
        <DMHero ship={ship} contact={contact} />
        <span className="font-semibold">
          {contact?.nickname ? contact.nickname : ship} is sending you a new
          message
        </span>
        <div className="flex space-x-2">
          <button className="button" onClick={onAccept} type="button">
            Accept
          </button>
          <button
            className="button"
            onClick={() => setShowDeclineModal(true)}
            type="button"
          >
            Decline
          </button>
        </div>
      </div>
      {showDeclineModal ? (
        <div className="absolute z-10 flex h-full w-full flex-col items-center justify-center bg-gray-400/[0.16]">
          <div className="flex h-[216px] min-w-[300px] max-w-[500px] flex-col items-center justify-start rounded-xl bg-white p-6">
            <div className="flex w-full items-center justify-between">
              <span className="text-lg font-bold">Decline Message</span>
              <button
                onClick={() => setShowDeclineModal(false)}
                className="flex h-6 w-6 items-center justify-center rounded-xl bg-gray-50"
              >
                <X16Icon className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            <span className="pt-4 leading-5">
              Are you sure you want to decline this message? Declining will
              remove this chat from your messages.{' '}
              <span className="font-bold">
                {contact?.nickname ? contact.nickname : ship}
              </span>{' '}
              can still send you new message invitations.
            </span>
            <div className="flex w-full justify-end space-x-2 pt-7">
              <button
                className="button bg-gray-50 text-gray-800"
                onClick={() => setShowDeclineModal(false)}
              >
                Cancel
              </button>
              <button className="button bg-red" onClick={onDecline}>
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
