import cn from 'classnames';
import { useLureLinkStatus } from '@/state/lure/lure';
import { isGroupHost } from '@/logic/utils';
import CheckIcon from '@/components/icons/CheckIcon';
import { Group } from '@/types/groups';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import QRWidget from '@/components/QRWidget';

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

  if (status === 'unsupported') {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {status === 'ready' ? (
        <QRWidget
          link={shareUrl}
          navigatorTitle={`Join ${group?.meta.title ?? flag}`}
        />
      ) : status !== 'disabled' ? (
        <div className="flex min-h-[128px] w-full items-center justify-center">
          <LoadingSpinner className="h-4 w-4" />
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
              status === 'disabled' ? 'border border-gray-100' : 'bg-blue-500'
            )}
          >
            <CheckIcon className="h-4 w-4 text-white" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
