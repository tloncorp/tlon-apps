import React from 'react';
import {
  makePrettyDayAndDateAndTime,
  makePrettyDayAndTime,
  makePrettyTime,
} from '@/logic/utils';
import { useLocation } from 'react-router';
import { useModalNavigate } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';

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
  const modalNavigate = useModalNavigate();
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

  if (!date) {
    return (
      <div className="align-center group flex items-center space-x-3 py-1">
        <div onClick={handleProfileClick}>
          <Avatar ship={ship} size="xs" className="cursor-pointer" />
        </div>
        <ShipName name={ship} showAlias className="text-md font-semibold" />
      </div>
    );
  }

  return (
    <div className="align-center group flex items-center space-x-3 py-1">
      <div onClick={handleProfileClick}>
        <Avatar ship={ship} size="xs" className="cursor-pointer" />
      </div>
      <ShipName name={ship} showAlias className="text-md font-semibold" />
      {hideTime ? (
        <span className="hidden text-sm font-semibold text-gray-500 group-hover:block">
          {prettyDayAndTime}
        </span>
      ) : (
        <>
          <span className="hidden text-sm font-semibold text-gray-500 group-hover:block">
            {prettyDayAndDateAndTime}
          </span>
          <span className="block text-sm font-semibold text-gray-500 group-hover:hidden">
            {timeOnly ? prettyTime : prettyDayAndTime}
          </span>
        </>
      )}
    </div>
  );
}
