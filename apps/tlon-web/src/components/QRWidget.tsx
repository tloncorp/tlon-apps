import CopyIcon from '@/components/icons/CopyIcon';
import { useCopy } from '@/logic/utils';
import { useCurrentTheme } from '@/state/local';
import cn from 'classnames';
import { useMemo } from 'react';
import QRCode from 'react-qr-code';

import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import CheckIcon from './icons/CheckIcon';
import ShareIcon from './icons/ShareIcon';

export default function QRWidget({
  link,
  className,
  navigatorTitle,
}: {
  link: string;
  className?: string;
  navigatorTitle: string;
}) {
  const url = useMemo(() => new URL(link), [link]);
  const { didCopy, doCopy } = useCopy(link);
  const displayURL = url.hostname + url.pathname;

  const handleCopy = () => {
    if (navigator.share !== undefined) {
      navigator.share({
        title: navigatorTitle,
        url: link,
      });
    } else {
      doCopy();
    }
  };

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col rounded-xl bg-blue-200',
        className
      )}
      onClick={handleCopy}
    >
      <div className="flex flex-1 items-center justify-center py-8">
        <QRCode value={link} size={200} fgColor="#3b82f6" bgColor="#bfdbfe" />
      </div>
      <div className="flex items-center justify-between rounded-b-xl bg-blue-500 px-6 py-4 text-blue-100">
        <span className="w-4/5 truncate text-lg">{displayURL}</span>
        {navigator.share !== undefined ? (
          <ShareIcon className="w-6" />
        ) : didCopy ? (
          <CheckIcon className="w-6" />
        ) : (
          <CopyIcon className="w-6" />
        )}
      </div>
    </div>
  );
}

export function QRWidgetPlaceholder({
  link,
  className,
  type = 'loading',
  errorMessage,
}: {
  link?: string;
  className?: string;
  type?: 'loading' | 'error';
  errorMessage?: string;
}) {
  const theme = useCurrentTheme();
  const value =
    link || (type === 'loading' ? 'Invite loading...' : 'Invite Link Error');
  const junkQR = 'https://tlon.io?noise=placeholdeplaceholderplaceholderpla';
  const message = errorMessage || 'Something appears to have gone wrong';

  const fgColor = theme === 'light' ? '#E5E5E5' : '#333333';
  const bgColor = theme === 'light' ? '#808080' : '#999999';

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col rounded-xl bg-gray-100',
        className
      )}
    >
      <div className="flex flex-1 items-center justify-center py-8">
        {type === 'loading' && (
          <QRCode
            value={junkQR}
            size={200}
            fgColor={fgColor}
            bgColor={bgColor}
          />
        )}
        {type === 'error' && (
          <div className="flex h-[200px] items-center justify-center px-4 text-lg text-black">
            <p className="text-center">{message}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between rounded-b-xl bg-gray-200 px-6 py-4 text-blue-100">
        <span className="w-4/5 truncate text-lg text-gray-500">{value}</span>
        {type === 'loading' && (
          <LoadingSpinner
            className="w-6"
            primary="fill-gray-400"
            secondary="fill-gray-700"
          />
        )}
      </div>
    </div>
  );
}
