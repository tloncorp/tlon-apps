import { Group } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import { useEffect } from 'react';

import QRWidget, { QRWidgetPlaceholder } from '@/components/QRWidget';
import CheckIcon from '@/components/icons/CheckIcon';
import { isGroupHost } from '@/logic/utils';
import { useLureLinkStatus } from '@/state/lure/lure';

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
  const { status, shareUrl, toggle } = useLureLinkStatus(flag);
  useEffect(() => {
    console.log(`Invite block for ${flag}`);
    console.log(`status: ${status}`);
    console.log(`shareUrl: ${shareUrl}`);
  }, [flag, status, shareUrl]);

  if (status === 'unsupported') {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <h2 className="mb-2 text-lg font-semibold">Web links</h2>
        <p className="leading-5 text-gray-600">
          Share your group with others by sending them a link.
        </p>
      </div>

      {status === 'ready' && shareUrl && (
        <QRWidget
          link={shareUrl}
          navigatorTitle={`Join ${group?.meta.title ?? flag}`}
        />
      )}

      {status === 'disabled' && !isGroupHost(flag) && (
        <div className="w-full rounded-xl border border-gray-200 bg-gray-100 py-4 text-center uppercase text-gray-500">
          Invite Links Disabled for this Group
        </div>
      )}

      {status === 'error' && (
        <QRWidgetPlaceholder
          type="error"
          errorMessage="There seems to be an issue with our invite link service."
        />
      )}

      {status === 'unsupported' && (
        <QRWidgetPlaceholder
          type="error"
          errorMessage="Invite links are unsupported for this group."
        />
      )}

      {status === 'loading' && <QRWidgetPlaceholder />}

      {isGroupHost(flag) ? (
        <button
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 px-6 py-4 text-lg"
          onClick={toggle(group?.meta || emptyMeta)}
        >
          Enable Links
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
              status === 'disabled' || status === 'loading'
                ? 'border border-gray-100'
                : 'bg-blue-500'
            )}
          >
            <CheckIcon className="h-4 w-4 text-white" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
