import cn from 'classnames';
import { useLure, useLureLinkChecked } from '@/state/lure/lure';
import { getFlagParts, isGroupHost, useCopy } from '@/logic/utils';
import CheckIcon from '@/components/icons/CheckIcon';
import { Group } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import { useCallback } from 'react';

interface LureInviteBlock {
  flag: string;
  group?: Group;
  className?: string;
}

const emptyMeta = {
  title: '',
  description: '',
  image: '',
  cover: '',
};

export default function LureInviteBlock({
  flag,
  group,
  className,
}: LureInviteBlock) {
  const { supported, fetched, enabled, enableAcked, url, toggle } =
    useLure(flag);
  const { good, checked } = useLureLinkChecked(flag, !!enabled);
  const { didCopy, doCopy } = useCopy(url);

  const retry = useCallback(() => {
    const meta = group?.meta || emptyMeta;
    toggle(meta)();
    setTimeout(toggle(meta), 500);
  }, [toggle, group]);

  if (!supported) {
    return null;
  }

  return (
    <div className={cn('card space-y-4 bg-blue-soft', className)}>
      <div>
        <h2 className="mb-1 flex text-lg font-bold">
          <span>Invite someone from outside the Urbit network</span>
          <span className=" small-button ml-auto self-start bg-blue-soft uppercase text-blue mix-blend-multiply dark:bg-blue-softer dark:mix-blend-normal">
            New
          </span>
        </h2>
        <p className="text-sm font-semibold text-gray-400">
          Courtesy of Tlon Hosting
        </p>
      </div>
      <p className="leading-5">
        Have friends, family or collaborators who aren&rsquo;t on Urbit?
      </p>
      <p className="leading-5">
        You can now gift them an Urbit ID and onboard them to your group all in
        one free and easy sweep. Just copy and share the link below.
      </p>
      {isGroupHost(flag) && (
        <>
          <div className="flex flex-row">
            <label
              className={
                'flex cursor-pointer items-start justify-between space-x-2 py-2'
              }
            >
              <div className="flex items-center">
                {enabled ? (
                  <div className="flex h-4 w-4 items-center rounded-sm border-2 border-gray-400">
                    <CheckIcon className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-4 w-4 rounded-sm border-2 border-gray-200" />
                )}
              </div>

              <div className="flex w-full flex-col">
                <div className="flex flex-row space-x-2">
                  <div className="flex w-full flex-col justify-start text-left">
                    <span className="font-semibold">Invite Links</span>
                  </div>
                </div>
              </div>

              <input
                checked={enabled}
                onChange={toggle(group?.meta || emptyMeta)}
                className="sr-only"
                type="checkbox"
              />
            </label>
          </div>
          {!enabled && (
            <div className="flex w-full flex-1 rounded-lg border-2 border-gray-100 bg-gray-100 py-1 px-2 text-lg font-semibold  leading-5 text-gray-600 mix-blend-multiply focus:outline-none dark:mix-blend-screen sm:text-base sm:leading-5">
              Enable to view invite link
            </div>
          )}
        </>
      )}
      {enabled && enableAcked ? (
        <div className="relative flex flex-1 items-center space-x-2">
          {!checked && (
            <div className="flex w-full flex-1 items-center space-x-2 rounded-lg border-2 border-blue-soft bg-blue-soft py-1 px-2 text-lg font-semibold leading-5 text-blue mix-blend-multiply dark:mix-blend-screen sm:text-base sm:leading-5">
              <LoadingSpinner className="h-4 w-4 text-blue" />
              <span className="font-semibold text-blue">
                {url ? 'Verifying link...' : 'Generating link...'}
              </span>
            </div>
          )}
          {url !== '' && checked && !good && (
            <>
              <div className="flex w-full flex-1 items-center space-x-2 rounded-lg border-2 border-blue-soft bg-blue-soft py-1 px-2 text-lg font-semibold leading-5 text-blue mix-blend-multiply dark:mix-blend-screen sm:text-base sm:leading-5">
                <span className="font-semibold text-blue">
                  Error creating link
                </span>
              </div>
              <button className="button" onClick={retry}>
                Retry
              </button>
            </>
          )}
          {url !== '' && checked && good && (
            <>
              <input
                value={url}
                readOnly
                className="flex w-full flex-1 rounded-lg border-2 border-blue-soft bg-blue-soft py-1 px-2 text-lg font-semibold  leading-5 text-blue caret-blue-400 mix-blend-multiply focus:outline-none dark:mix-blend-screen sm:text-base sm:leading-5"
              />
              <button className="button bg-blue" onClick={doCopy}>
                {didCopy ? 'Copied!' : 'Copy'}
              </button>
            </>
          )}
        </div>
      ) : !isGroupHost(flag) ? (
        <div className="flex items-center space-x-2 font-semibold">
          {fetched ? (
            <span>
              Link not enabled, contact{' '}
              <ShipName
                name={getFlagParts(flag).ship}
                className="font-semibold"
              />
            </span>
          ) : (
            <>
              <LoadingSpinner className="h-4 w-4" />
              <span>Fetching Link</span>
            </>
          )}
        </div>
      ) : null}
      {enabled && !enableAcked && (
        <p className="leading-5 text-red">
          The invite link service has not responded yet. Your ship might not be
          able to communicate with it, or it might be offline.
        </p>
      )}
    </div>
  );
}
