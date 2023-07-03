import React, { useEffect } from 'react';
import cn from 'classnames';
import useGroupJoin from '@/groups/useGroupJoin';
import { useGang, useGangPreview } from '@/state/groups';
import GroupAvatar from '@/groups/GroupAvatar';
import {
  getFlagParts,
  isImageUrl,
  matchesBans,
  pluralRank,
  toTitleCase,
} from '@/logic/utils';
import ShipName from '@/components/ShipName';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';

interface GroupReferenceProps {
  flag: string;
  isScrolling?: boolean;
  plain?: boolean;
  onlyButton?: boolean;
  description?: string;
  contextApp?: string;
}

function GroupReference({
  flag,
  isScrolling = false,
  plain = false,
  onlyButton = false,
  description,
  contextApp,
}: GroupReferenceProps) {
  const gang = useGang(flag);
  const preview = useGangPreview(flag, isScrolling);
  const { group, privacy, open, reject, button, status } = useGroupJoin(
    flag,
    gang
  );
  const { ship } = getFlagParts(flag);
  const cordon = preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;

  const meta = group?.meta || preview?.meta;

  const referenceUnavailable =
    privacy === 'secret' &&
    !(window.our in (group?.fleet ?? {})) &&
    !(gang?.invite && gang.invite.ship === window.our);

  if (referenceUnavailable) {
    return (
      <div className="relative flex h-16 items-center space-x-3 rounded-lg border-2 border-gray-50 bg-gray-50 p-2 text-base font-semibold text-gray-600">
        <ExclamationPoint className="h-8 w-8 text-gray-400" />
        <span>This content is unavailable to you</span>
      </div>
    );
  }

  if (onlyButton) {
    return (
      <div>
        {banned ? (
          <div className="rounded-lg bg-gray-100 p-2 text-center text-xs font-semibold leading-3 text-gray-600">
            {banned === 'ship'
              ? 'You are banned'
              : `${toTitleCase(pluralRank(banned))} are banned`}
          </div>
        ) : (
          <>
            {gang.invite && !group && status !== 'loading' ? (
              <button
                className="small-button bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject
              </button>
            ) : null}
            {status === 'loading' ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Joining...</span>
                <LoadingSpinner />
              </div>
            ) : (
              <button
                className="small-button ml-3 whitespace-nowrap bg-blue-soft text-blue dark:text-black"
                onClick={button.action}
                disabled={button.disabled || status === 'error'}
              >
                {status === 'error' ? 'Errored' : button.text}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  if (contextApp === 'heap-block') {
    const { title, cover } = meta || {
      title: '',
      cover: '',
    };
    return (
      <div className={cn('h-full w-full')}>
        {isImageUrl(cover) ? (
          <img
            src={cover}
            loading="lazy"
            className="absolute top-0 left-0 h-full w-full"
          />
        ) : (
          <div
            style={{ background: cover }}
            className="absolute top-0 left-0 h-full w-full"
          />
        )}
        <div className="absolute top-2 left-2 flex items-center space-x-2 rounded p-2 text-base font-bold">
          <GroupAvatar {...meta} size="h-6 w-6" />
          <span
            className="text-white"
            style={{ textShadow: 'black 0px 1px 3px' }}
          >
            {title}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'not-prose items-top relative flex max-w-[300px] rounded-lg bg-white text-base transition-colors hover:border-gray-100 hover:bg-white group-one-hover:border-gray-100 group-one-hover:bg-white',
        {
          'border-2 border-gray-50': !plain,
        },
        contextApp === 'heap-detail' ? 'mb-0 h-full border-none' : 'mb-2'
      )}
    >
      <button
        className="flex w-full items-center justify-start rounded-lg p-2 text-left"
        onClick={open}
      >
        <div className="items-top flex space-x-3 font-semibold">
          <GroupAvatar {...meta} size="h-12 w-12" />
          <div className="overflow-hidden text-ellipsis text-sm leading-5">
            <h3 className="line-clamp-1">{meta?.title || flag} </h3>
            {!plain && (
              <span className="flex space-x-1 text-sm font-semibold text-gray-400 line-clamp-1">
                <span>by</span>
                <ShipName
                  className="overflow-hidden text-ellipsis whitespace-nowrap"
                  name={ship}
                />
              </span>
            )}
            {!plain && (
              <>
                <span className="text-sm capitalize text-gray-400">
                  Group • {privacy}
                </span>
                <p className="text-sm text-gray-800">{meta?.description}</p>
              </>
            )}
          </div>
        </div>
      </button>
      <div className="mr-2 flex flex-row pt-2">
        {banned ? (
          <div className="rounded-lg bg-gray-100 p-2 text-center text-xs font-semibold leading-3 text-gray-600">
            {banned === 'ship'
              ? 'You are banned'
              : `${toTitleCase(pluralRank(banned))} are banned`}
          </div>
        ) : (
          <>
            {gang.invite && !group && status !== 'loading' ? (
              <button
                className="small-button bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject
              </button>
            ) : null}
            {status === 'loading' ? (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Joining...</span>
                <LoadingSpinner />
              </div>
            ) : (
              <button
                className="small-button ml-3 whitespace-nowrap bg-blue-softer text-blue dark:text-black"
                onClick={button.action}
                disabled={button.disabled || status === 'error'}
              >
                {status === 'error' ? 'Errored' : button.text}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(GroupReference);
