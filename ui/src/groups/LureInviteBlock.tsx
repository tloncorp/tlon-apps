import cn from 'classnames';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLure, useLureLinkChecked } from '@/state/lure/lure';
import { isGroupHost, useCopy } from '@/logic/utils';
import CheckIcon from '@/components/icons/CheckIcon';
import { Group } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsDark } from '@/logic/useMedia';
import CopyIcon from '@/components/icons/CopyIcon';
import ShareIcon from '@/components/icons/ShareIcon';

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
  const { supported, fetched, enabled, enableAcked, url, deepLinkUrl, toggle } =
    useLure(flag);
  const { good, checked } = useLureLinkChecked(flag, !!enabled);
  const [qrCode, setQrCode] = useState<string | undefined>();
  const isDarkMode = useIsDark();
  const isAvailable = !!(
    enabled &&
    enableAcked &&
    fetched &&
    url &&
    good &&
    checked
  );
  const shareUrl = deepLinkUrl ?? url;
  const { didCopy, doCopy } = useCopy(shareUrl);

  useEffect(() => {
    if (isAvailable) {
      QRCode.toDataURL(
        shareUrl,
        {
          margin: 0,
          color: {
            dark: isDarkMode ? '#fff' : '#333',
            light: isDarkMode ? '#000' : '#fff',
          },
        },
        (_, dataUrl) => {
          setQrCode(dataUrl);
        }
      );
    }
  }, [isDarkMode, isAvailable, shareUrl]);

  if (!supported) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {isAvailable ? (
        <div className="space-y-3">
          <div className="w-[60%] max-w-[256px]">
            {qrCode ? (
              <div className="rounded-xl border border-gray-100 p-4">
                <img className="w-full" src={qrCode} />
              </div>
            ) : (
              <div className="aspect-w-1 aspect-h-1">
                <div className="flex h-full w-full items-center justify-center">
                  <LoadingSpinner className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>
          <button
            className="flex w-full items-center justify-between gap-2 rounded-xl bg-blue-soft px-6 py-4 text-lg text-blue active:bg-blue-soft/90"
            onClick={
              navigator.share !== undefined
                ? () => {
                    navigator.share({
                      title: `Join ${group?.meta.title ?? flag}`,
                      url: shareUrl,
                    });
                  }
                : doCopy
            }
          >
            <span className="truncate">{shareUrl.replace('https://', '')}</span>
            {navigator.share !== undefined ? (
              <ShareIcon className="w-8" />
            ) : didCopy ? (
              <CheckIcon className="w-8" />
            ) : (
              <CopyIcon className="w-8" />
            )}
          </button>
        </div>
      ) : null}
      {isGroupHost(flag) ? (
        <button
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 px-6 py-4 text-lg"
          onClick={toggle(group?.meta || emptyMeta)}
        >
          Enable Links
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              enabled ? 'bg-blue-500' : 'border border-gray-100'
            )}
          >
            <CheckIcon className="h-4 w-4 text-white" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
