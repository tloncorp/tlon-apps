import { Group } from '@tloncorp/shared/urbit/groups';
import { isHost } from '@urbit/api';
import cn from 'classnames';
import { useEffect } from 'react';

import QRWidget, { QRWidgetPlaceholder } from '@/components/QRWidget';
import { isGroupHost } from '@/logic/utils';
import { useLure } from '@/state/lure/lure';

interface LureInviteBlock {
  flag: string;
  group?: Group;
  className?: string;
}
export default function LureInviteBlock({
  flag,
  group,
  className,
}: LureInviteBlock) {
  const { status, shareUrl } = useLure(flag);
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

      {(status === 'loading' ||
        (status === 'disabled' && isGroupHost(flag))) && (
        <QRWidgetPlaceholder />
      )}
    </div>
  );
}
