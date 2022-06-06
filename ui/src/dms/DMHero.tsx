import { Contact, Patp } from '@urbit/api';
import React from 'react';
import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';

interface DMHeroProps {
  ship: Patp;
  contact?: Contact;
}

export default function DMHero({ ship, contact }: DMHeroProps) {
  return (
    <div className="flex flex-col items-center space-y-1">
      <Avatar ship={ship} size="huge" icon={false} />
      {contact?.nickname ? (
        <div className="flex flex-col items-center pt-1">
          <span className="font-semibold">{contact.nickname}</span>
          <ShipName className="pt-1 text-gray-600" name={ship} />
        </div>
      ) : (
        <ShipName className="pt-1 text-gray-600" name={ship} />
      )}
      {/*
      TODO: Show mutual groups.
      */}
    </div>
  );
}
