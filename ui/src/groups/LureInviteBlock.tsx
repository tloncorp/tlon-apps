import cn from 'classnames';
import { useLure } from '@/state/lure/lure';
import TlonIcon from '@/components/icons/TlonIcon';
import { isGroupHost, useCopy } from '@/logic/utils';
import CheckIcon from '@/components/icons/CheckIcon';
import { Group } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';

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
  const { supported, fetched, enabled, url, toggle } = useLure(flag);
  const { didCopy, doCopy } = useCopy(url);

  if (!supported) {
    return null;
  }

  return (
    <div className={cn('card space-y-4 bg-blue-soft', className)}>
      <div>
        <h2 className="mb-1 flex text-lg font-bold">
          <span>Send Landscape Invite to Someone</span>
          <TlonIcon className="ml-auto h-6 w-6 p-1" />
        </h2>
        <p className="text-sm font-semibold text-gray-400">
          Courtesy of Tlon Hosting
        </p>
      </div>
      <p className="leading-5">
        Invite someone to this group and gift them an urbit, all with one link.
        Send these to friends, family, and collaborators to get them into Urbit
        easily.
      </p>
      {isGroupHost(flag) && (
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
                  <span className="font-semibold">Invite Link Enabled</span>
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
      )}
      {enabled ? (
        <div className="flex items-center space-x-2">
          <div className="relative max-w-md flex-1">
            {url === '' ? (
              <LoadingSpinner className="absolute right-2 my-2 h-4 w-4" />
            ) : null}
            <input
              value={url}
              readOnly
              className="flex w-full flex-1 rounded-lg border-2 border-blue-soft bg-blue-soft py-1 px-2 text-lg font-semibold  leading-5 text-blue caret-blue-400 mix-blend-multiply focus:outline-none dark:mix-blend-screen sm:text-base sm:leading-5"
            />
          </div>
          <button className="button bg-blue" onClick={doCopy}>
            {didCopy ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ) : !isGroupHost(flag) ? (
        <div className="flex items-center space-x-2 font-semibold">
          {fetched ? (
            'Link not enabled, contact group host'
          ) : (
            <>
              <LoadingSpinner className="h-4 w-4" />
              <span>Fetching Link</span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
