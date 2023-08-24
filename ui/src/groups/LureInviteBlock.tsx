import cn from 'classnames';
import { useLure, useLureLinkChecked } from '@/state/lure/lure';
import { getFlagParts, isGroupHost, useCopy } from '@/logic/utils';
import CheckIcon from '@/components/icons/CheckIcon';
import { Group } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import ShipName from '@/components/ShipName';
import { useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useIsDark } from '@/logic/useMedia';

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
  const isDark = useIsDark();

  const retry = useCallback(() => {
    const meta = group?.meta || emptyMeta;
    toggle(meta)();
    setTimeout(toggle(meta), 500);
  }, [toggle, group]);

  if (!supported) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
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
                <div className="flex w-full flex-col justify-start text-left leading-5">
                  <span className="font-semibold">
                    Enable public invite links
                  </span>

                  {!enabled && !enableAcked ? (
                    <span className="mt-1 text-gray-400">
                      Have friends, family or collaborators who aren&rsquo;t on
                      Urbit? You can now gift them an Urbit ID and onboard them
                      to your group all in one free and easy sweep, courtesy of
                      Tlon Hosting. Just copy and share a link, or allow them to
                      scan a QR code.
                    </span>
                  ) : null}
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
      {enabled && enableAcked ? (
        <>
          {!checked && (
            <div className="flex items-center space-x-2 rounded-lg bg-blue-soft py-4 px-6 text-blue">
              <LoadingSpinner className="h-4 w-4 text-blue" />
              <span className="">
                {url ? 'Verifying link...' : 'Generating link...'}
              </span>
            </div>
          )}
          {url !== '' && checked && !good && (
            <div className="flex items-center space-x-2 rounded-lg bg-blue-soft py-4 px-6 text-blue">
              <LoadingSpinner className="h-4 w-4 text-blue" />
              <span>{url ? 'Verifying link...' : 'Generating link...'}</span>
            </div>
          )}
          {url !== '' && checked && !good && (
            <div className="flex flex-col">
              <div className="rounded-t-lg bg-red-soft py-4 px-6 text-red">
                Error creating link
              </div>
              <button
                className="button justify-start rounded-t-none py-4 px-6 font-normal"
                onClick={retry}
              >
                Retry
              </button>
            </div>
          )}
          {url !== '' && checked && good && (
            <>
              <div className="flex items-center justify-center rounded-lg bg-gray-50">
                <QRCodeSVG
                  value={url}
                  size={256}
                  bgColor="transparent"
                  fgColor={isDark ? '#ffffff' : '#000000'}
                  level={'H'}
                  includeMargin={true}
                />
              </div>
              <div className="flex flex-col">
                <input
                  value={url}
                  readOnly
                  className="rounded-t-lg bg-blue-soft py-4 px-6 text-blue dark:text-black"
                />

                <button
                  className="button justify-start rounded-t-none bg-blue py-4 px-6 font-normal dark:text-black"
                  onClick={doCopy}
                >
                  {didCopy ? 'Copied!' : 'Copy Group Link'}
                </button>
              </div>
            </>
          )}
        </>
      ) : !isGroupHost(flag) ? (
        <div className="flex items-center space-x-2 rounded-lg bg-blue-soft py-4 px-6 text-blue">
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
              <span>Fetching link...</span>
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
