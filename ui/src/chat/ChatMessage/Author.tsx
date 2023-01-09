import React from 'react';
import {
  makePrettyDayAndDateAndTime,
  makePrettyDayAndTime,
  makePrettyTime,
  useCopy,
} from '@/logic/utils';
import { useLocation } from 'react-router';
import { useModalNavigate } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import usePalsState from '@/state/pals';
import PeopleIcon from '@/components/icons/PeopleIcon';

interface AuthorProps {
  ship: string;
  date?: Date;
  timeOnly?: boolean;
  hideTime?: boolean;
}
export default function Author({
  ship,
  date,
  timeOnly,
  hideTime,
}: AuthorProps) {
  const location = useLocation();
  const { didCopy, doCopy } = useCopy(ship);
  const modalNavigate = useModalNavigate();
  const { pals } = usePalsState();
  const prettyTime = date ? makePrettyTime(date) : undefined;
  const prettyDayAndTime = date ? makePrettyDayAndTime(date) : undefined;
  const prettyDayAndDateAndTime = date
    ? makePrettyDayAndDateAndTime(date)
    : undefined;

  const handleProfileClick = () => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  const isPal = Boolean(pals.outgoing[ship.replace('~', '')]?.ack);

  if (!date) {
    return (
      <div className="align-center group flex items-center space-x-3 py-1">
        <div onClick={handleProfileClick} className="shrink-0">
          <Avatar ship={ship} size="xs" className="cursor-pointer" />
        </div>
        <div
          onClick={doCopy}
          className="text-md shrink cursor-pointer font-semibold"
        >
          {didCopy ? (
            'Copied!'
          ) : (
            <ShipName
              name={ship}
              showAlias
              className="text-md font-semibold line-clamp-1"
            />
          )}
        </div>
        {isPal && <PeopleIcon className='h-4 w-4' />}
      </div>
    );
  }

  return (
    <div className="align-center group flex items-center space-x-3 py-1">
      <div onClick={handleProfileClick} className="shrink-0">
        <Avatar ship={ship} size="xs" className="cursor-pointer" />
      </div>
      <div
        onClick={doCopy}
        className="text-md shrink cursor-pointer font-semibold"
      >
        {didCopy ? (
          'Copied!'
        ) : (
          <ShipName
            name={ship}
            showAlias
            className="text-md font-semibold line-clamp-1"
          />
        )}
      </div>
      {isPal && <PeopleIcon className='ml-1 h-4 w-4' />}

      {hideTime ? (
        <span className="hidden shrink-0 text-sm font-semibold text-gray-500 group-hover:block">
          {prettyDayAndTime}
        </span>
      ) : (
        <>
          <span className="hidden shrink-0 text-sm font-semibold text-gray-500 group-hover:block">
            {prettyDayAndDateAndTime}
          </span>
          <span className="block shrink-0 text-sm font-semibold text-gray-500 group-hover:hidden">
            {timeOnly ? prettyTime : prettyDayAndTime}
          </span>
        </>
      )}
    </div>
  );
}
