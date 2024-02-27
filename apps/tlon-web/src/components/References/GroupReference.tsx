import cn from 'classnames';
import React from 'react';

import ShipName from '@/components/ShipName';
import ExclamationPoint from '@/components/icons/ExclamationPoint';
import GroupAvatar from '@/groups/GroupAvatar';
import useGroupJoin from '@/groups/useGroupJoin';
import {
  getFlagParts,
  isImageUrl,
  matchesBans,
  pluralRank,
  toTitleCase,
} from '@/logic/utils';
import { useGang, useGangPreview } from '@/state/groups';
import { useCalm } from '@/state/settings';

import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import ReferenceInHeap from './ReferenceInHeap';

interface GroupReferenceProps {
  flag: string;
  isScrolling?: boolean;
  plain?: boolean;
  onlyButton?: boolean;
  description?: string;
  contextApp?: string;
  children?: React.ReactNode;
  customOnClick?: (flag: string) => void;
}

function GroupReference({
  flag,
  isScrolling = false,
  plain = false,
  onlyButton = false,
  contextApp,
  children,
  customOnClick,
}: GroupReferenceProps) {
  const calm = useCalm();
  const gang = useGang(flag);
  const preview = useGangPreview(flag, isScrolling);
  const { group, privacy, open, reject, button, status } = useGroupJoin(
    flag,
    gang,
    plain
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
    return onlyButton ? (
      <button className="small-button" disabled={true}>
        Unavailable
      </button>
    ) : (
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
                onClick={open}
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

  if (contextApp === 'heap-row') {
    const refImage = () => {
      if (meta && isImageUrl(meta.image)) {
        return (
          <img
            src={meta?.image}
            className="h-[72px] w-[72px] rounded object-cover"
          />
        );
      }
      return (
        <div
          className="h-[72px] w-[72px] rounded"
          style={{ background: meta?.image }}
        />
      );
    };

    return (
      <ReferenceInHeap
        contextApp={contextApp}
        image={refImage()}
        title={meta?.title}
        byline={<span className="capitalize">{privacy} Group</span>}
      >
        {children}
      </ReferenceInHeap>
    );
  }

  if (contextApp === 'heap-block') {
    return (
      <ReferenceInHeap
        contextApp={contextApp}
        image={
          <div className={cn('h-full w-full')}>
            {meta && isImageUrl(meta.cover) ? (
              <img
                src={meta.cover}
                loading="lazy"
                className="absolute left-0 top-0 h-full w-full object-cover"
              />
            ) : (
              <div
                style={{ background: meta?.cover }}
                className="absolute left-0 top-0 h-full w-full"
              />
            )}
            <div className="absolute left-2 top-2 flex items-center space-x-2 rounded p-2 text-base font-bold">
              <GroupAvatar {...meta} size="h-6 w-6" />
              <span
                className="text-white dark:text-black"
                style={{ textShadow: 'black 0px 1px 3px' }}
              >
                {meta?.title}
              </span>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <div
      className={cn(
        'not-prose flex min-w-[300px] max-w-[600px] items-center space-x-2 rounded-lg bg-white p-2 transition-colors hover:border-gray-100 group-one-hover:border-gray-100 group-one-hover:bg-white',
        {
          'border-2 border-gray-50': !plain,
        },
        contextApp === 'heap-detail'
          ? 'mb-0 border-transparent hover:border-transparent'
          : ''
      )}
    >
      <button
        className="flex w-full items-center justify-between space-x-2 text-left"
        onClick={customOnClick ? () => customOnClick(flag) : open}
      >
        <GroupAvatar {...meta} size="h-12 w-12 shrink-0" />
        <div className="grow text-sm font-semibold leading-4">
          <h3 className="line-clamp-1">{meta?.title || flag} </h3>
          {!plain && (
            <p className="line-clamp-1 font-medium text-gray-400">
              by{' '}
              <ShipName
                className="overflow-hidden text-ellipsis whitespace-nowrap"
                name={ship}
                showAlias={!calm.disableNicknames}
              />
            </p>
          )}
          {!plain && (
            <p className="font-medium capitalize text-gray-400">
              {privacy} Group
            </p>
          )}
        </div>
      </button>
      <div className="h-full shrink-0">
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
                className="small-button mr-3 bg-red text-white dark:text-black"
                onClick={reject}
              >
                Reject
              </button>
            ) : null}
            {status === 'loading' ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-gray-400">
                  Joining...
                </span>
                <LoadingSpinner />
              </div>
            ) : (
              <button
                className="small-button whitespace-nowrap bg-blue text-white dark:text-black"
                onClick={plain ? button.action : open}
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
