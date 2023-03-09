import React from 'react';
import cn from 'classnames';
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

interface AuthorProps {
  ship: string;
  date?: Date;
  timeOnly?: boolean;
  hideTime?: boolean;
  isReply?: boolean;
  isRef?: boolean;
  className?: string;
}
export default function Author({
  ship,
  date,
  timeOnly,
  hideTime,
  className,
  isReply = false,
  isRef = false,
}: AuthorProps) {
  const location = useLocation();
  const { didCopy, doCopy } = useCopy(ship);
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
      <div
        className={cn(
          'align-center group flex items-center py-1',
          isReply || isRef ? 'space-x-2' : 'space-x-3',
          className
        )}
      >
        <div onClick={handleProfileClick} className="shrink-0">
          <Avatar
            ship={ship}
            size={isReply || isRef ? 'xxs' : 'xs'}
            className="cursor-pointer"
          />
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
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group-two align-center flex items-center py-1',
        isReply || isRef ? 'space-x-2' : 'space-x-3',
        className
      )}
    >
      <div onClick={handleProfileClick} className="shrink-0">
        <Avatar
          ship={ship}
          // The conditional here appears to have scoping
          // which affects the author avatar's size in both "chats themselves"
          // as well as within ReferenceRow components.
          size={isReply || isRef ? 'xxs' : 'xs'}
          className="cursor-pointer"
        />
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
            className="text-md break-all font-semibold line-clamp-1"
          />
        )}
      </div>

      {hideTime ? (
        <span className="-mb-0.5 hidden shrink-0 text-sm font-semibold text-gray-500 group-two-hover:block">
          {prettyDayAndTime}
        </span>
      ) : (
        <>
          <span className="-mb-0.5 hidden shrink-0 text-sm font-semibold text-gray-500 group-two-hover:block">
            {prettyDayAndDateAndTime}
          </span>
          <span className="-mb-0.5 block shrink-0 text-sm font-semibold text-gray-500 group-two-hover:hidden">
            {timeOnly ? prettyTime : prettyDayAndTime}
          </span>
        </>
      )}
    </div>
  );
}
