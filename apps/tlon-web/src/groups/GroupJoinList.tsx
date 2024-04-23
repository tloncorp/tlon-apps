import { Gang, Gangs } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import SidebarItem from '@/components/Sidebar/SidebarItem';
import { matchesBans } from '@/logic/utils';
import { useGang } from '@/state/groups';

import GroupAvatar from './GroupAvatar';
import useGroupJoin from './useGroupJoin';

interface GroupJoinItemProps {
  flag: string;
  highlight?: boolean;
  preload?: {
    title?: string;
    description?: string;
    image?: string;
  };
}

export function GroupJoinItem({
  flag,
  highlight,
  preload,
}: GroupJoinItemProps) {
  const gang: Gang = useGang(flag);
  const { open, button, status, group } = useGroupJoin(flag, gang, true);
  const cordon = gang.preview?.cordon || group?.cordon;
  const banned = cordon ? matchesBans(cordon, window.our) : null;

  return (
    <SidebarItem
      data-testid="group-join-item"
      onClick={() => open()}
      className={highlight ? 'bg-blue-soft dark:bg-blue-900' : ''}
      icon={
        !gang.preview && preload ? (
          <GroupAvatar {...preload} className="flex-none" size={'h-12 w-12'} />
        ) : (
          <GroupAvatar
            {...gang.preview?.meta}
            className="flex-none"
            size={'h-12 w-12'}
          />
        )
      }
      actions={
        banned ? (
          <div className="rounded-full bg-red-soft px-2 py-1 text-sm font-medium text-red ">
            Banned
          </div>
        ) : status === 'loading' ? (
          <div className="flex items-center justify-center space-x-2">
            <LoadingSpinner className="h-4 w-4" />
          </div>
        ) : (
          <button
            className={cn(
              'rounded-full bg-blue-soft px-2 py-1 text-sm font-medium text-blue mix-blend-multiply disabled:bg-gray-100  dark:bg-blue-500 dark:text-black dark:mix-blend-screen dark:disabled:bg-gray-100 '
            )}
            onClick={open}
          >
            {status === 'error'
              ? 'Errored'
              : highlight
                ? 'Invited'
                : button.text}
          </button>
        )
      }
    >
      <div className="flex h-12 flex-col justify-center">
        <h2>{gang.preview?.meta.title || preload?.title || flag}</h2>
        {preload?.description && (
          <p className="line-clamp-1 pr-12 text-sm font-normal text-gray-400 sm:mt-1">
            {preload?.description}
          </p>
        )}
      </div>
    </SidebarItem>
  );
}

interface GroupJoinListProps {
  gangs: Gangs;
  highlightAll?: boolean;
}

export default function GroupJoinList({
  gangs,
  highlightAll,
}: GroupJoinListProps) {
  const gangEntries = Object.entries(gangs);
  return (
    <>
      {gangEntries.map(([flag]) => (
        <div className="mx-4" key={flag}>
          <GroupJoinItem highlight={highlightAll} key={flag} flag={flag} />
        </div>
      ))}
    </>
  );
}
