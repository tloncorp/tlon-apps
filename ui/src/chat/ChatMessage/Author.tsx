import React from 'react';
import cn from 'classnames';
import { makePrettyDayAndDateAndTime, useCopy } from '@/logic/utils';
import { useLocation } from 'react-router';
import { useModalNavigate } from '@/logic/routing';
import Avatar from '@/components/Avatar';
import ShipName from '@/components/ShipName';
import RoleBadges from '@/components/RoleBadges';
import PalIcon from '@/components/PalIcon';

interface AuthorProps {
  ship: string;
  date?: Date;
  timeOnly?: boolean;
  hideTime?: boolean;
  hideRoles?: boolean;
  isReply?: boolean;
  isRef?: boolean;
  className?: string;
}
function Author({
  ship,
  date,
  timeOnly,
  hideTime,
  hideRoles = false,
  className,
  isReply = false,
  isRef = false,
}: AuthorProps) {
  const location = useLocation();
  const { didCopy, doCopy } = useCopy(ship);
  const modalNavigate = useModalNavigate();
  const timeDisplay = date ? makePrettyDayAndDateAndTime(date) : undefined;

  const handleProfileClick = () => {
    modalNavigate(`/profile/${ship}`, {
      state: { backgroundLocation: location },
    });
  };

  if (!timeDisplay) {
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
              className="text-md font-semibold leading-6 line-clamp-1"
            />
          )}
        </div>
        {hideRoles ? null : <RoleBadges ship={ship} />}
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
            className="text-md break-all font-semibold leading-6 line-clamp-1"
          />
        )}
      </div>
      <PalIcon ship={ship} />
      {hideRoles ? null : <RoleBadges ship={ship} />}
      {hideTime ? (
        <span className="-mb-0.5 hidden shrink-0 text-sm font-semibold text-gray-500 group-two-hover:block">
          {timeDisplay.day} <span role="presentation">&#x2022;</span>{' '}
          <time dateTime={timeDisplay.time}>{timeDisplay.time}</time>
        </span>
      ) : (
        <>
          <span className="-mb-0.5 hidden shrink-0 text-sm font-semibold text-gray-500 group-two-hover:block">
            {timeDisplay.diff >= 8 ? (
              <time dateTime={timeDisplay.original.toISOString()}>
                {timeDisplay.fullDate} <span aria-hidden>&#x2022;</span>{' '}
                {timeDisplay.time}
              </time>
            ) : (
              <>
                {timeDisplay.day} <span aria-hidden>&#x2022;</span>{' '}
                <time dateTime={timeDisplay.original.toISOString()}>
                  {timeDisplay.time} <span aria-hidden>&#x2022;</span>{' '}
                  {timeDisplay.fullDate}
                </time>
              </>
            )}
          </span>
          <span className="-mb-0.5 block shrink-0 text-sm font-semibold text-gray-500 group-two-hover:hidden">
            {!timeOnly && (
              <>
                {timeDisplay.day} <span aria-hidden>&#x2022;</span>{' '}
              </>
            )}
            <time dateTime={timeDisplay.time}>{timeDisplay.time}</time>
          </span>
        </>
      )}
    </div>
  );
}

export default React.memo(Author);
