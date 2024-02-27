import { Contact } from '@tloncorp/shared/dist/urbit/contact';
import { Patp } from '@urbit/api';
import { useLocation } from 'react-router';

import { useModalNavigate } from '@/logic/routing';

import Avatar from '../components/Avatar';
import ShipName from '../components/ShipName';

interface DMHeroProps {
  ship: Patp;
  contact?: Contact;
}

export default function DMHero({ ship, contact }: DMHeroProps) {
  const location = useLocation();
  const modalNavigate = useModalNavigate();

  const handleProfileClick = () => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <button onClick={handleProfileClick}>
        <Avatar ship={ship} size="huge" icon={false} />
      </button>
      <div className="flex flex-col items-center space-y-1">
        {contact?.nickname ? (
          <span className="font-semibold">{contact.nickname}</span>
        ) : null}
        <ShipName className="text-gray-600" name={ship} />
      </div>
      {/*
      TODO: Show mutual groups.
      */}
    </div>
  );
}
