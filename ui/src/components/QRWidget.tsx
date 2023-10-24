import { useMemo } from 'react';
import cn from 'classnames';
import QRCode from 'react-qr-code';
import { useCopy } from '@/logic/utils';
import CopyIcon from '@/components/icons/CopyIcon';
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
      <div className="flex items-center justify-between rounded-b-xl bg-blue-500 py-4 px-6 text-blue-100">
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
